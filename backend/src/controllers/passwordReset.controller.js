const passwordResetService = require('../services/passwordReset.service');

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }
    await passwordResetService.requestPasswordReset(email, req.ip);
    res.json({ message: 'If an account exists for that email, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

async function validateResetToken(req, res, next) {
  try {
    const { token } = req.params;
    const valid = await passwordResetService.validateResetToken(token);
    res.json({ valid });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'token and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'password must be at least 8 characters' });
    }
    await passwordResetService.resetPassword(token, password);
    res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { forgotPassword, validateResetToken, resetPassword };