const bcrypt = require('bcryptjs');
const UserModel = require('../models/User.model');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../config/jwt');

const SALT_ROUNDS = 12;

async function signup(req, res, next) {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.createUser({ email, passwordHash, fullName });

    const accessToken = signAccessToken({ userId: user.userId, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.userId });

    setRefreshCookie(res, refreshToken);
    res.status(201).json({
      user: { userId: user.userId, email: user.email, fullName: user.fullName },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.PASSWORDHASH);
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await UserModel.touchLastLogin(user.USERID);

    const accessToken = signAccessToken({ userId: user.USERID, email: user.EMAIL });
    const refreshToken = signRefreshToken({ userId: user.USERID });

    setRefreshCookie(res, refreshToken);
    res.json({
      user: { userId: user.USERID, email: user.EMAIL, fullName: user.FULLNAME },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    const payload = verifyRefreshToken(token);
    const user = await UserModel.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    const accessToken = signAccessToken({ userId: user.USERID, email: user.EMAIL });
    const newRefreshToken = signRefreshToken({ userId: user.USERID });

    setRefreshCookie(res, newRefreshToken);
    res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
}

async function logout(req, res) {
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });
  res.status(204).send();
}

async function me(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ userId: user.USERID, email: user.EMAIL, fullName: user.FULLNAME });
  } catch (err) {
    next(err);
  }
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

module.exports = { signup, login, refresh, logout, me };
