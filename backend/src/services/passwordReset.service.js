const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/User.model');
const PasswordResetTokenModel = require('../models/PasswordResetToken.model');
const emailService = require('./email.service');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;
const TOKEN_BYTES = 32;
const TOKEN_TTL_MINUTES = 30;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function requestPasswordReset(email, requestIp) {
  const user = await UserModel.findByEmail(email);
  // Always resolves the same way whether or not the account exists, so this
  // endpoint can never be used to discover which emails are registered.
  if (!user) {
    logger.info('Password reset requested for unknown email', { email });
    return;
  }

  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

  await PasswordResetTokenModel.invalidateAllForUser(user.USERID);
  await PasswordResetTokenModel.create({ userId: user.USERID, tokenHash, expiresAt, requestIp });

  const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || 'http://localhost:3000').replace(/\/+$/, '');
  const resetLink = `${frontendUrl}/reset-password/${rawToken}`;

  await emailService.sendMail({
    to: user.EMAIL,
    subject: 'Reset your migration console password',
    text:
      `We received a request to reset your password.\n\n` +
      `Reset it here (expires in ${TOKEN_TTL_MINUTES} minutes): ${resetLink}\n\n` +
      `If you didn't request this, you can safely ignore this email.`,
    html:
      `<p>We received a request to reset your password.</p>` +
      `<p><a href="${resetLink}">Click here to reset your password</a> (expires in ${TOKEN_TTL_MINUTES} minutes).</p>` +
      `<p>If you didn't request this, you can safely ignore this email.</p>`,
  });
}

async function validateResetToken(rawToken) {
  if (!rawToken) return false;
  const record = await PasswordResetTokenModel.findValidByHash(hashToken(rawToken));
  return !!record;
}

async function resetPassword(rawToken, newPassword) {
  const record = await PasswordResetTokenModel.findValidByHash(hashToken(rawToken));
  if (!record) {
    const err = new Error('This reset link is invalid or has expired');
    err.status = 400;
    throw err;
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserModel.updatePasswordHash(record.USERID, passwordHash);
  await PasswordResetTokenModel.markUsed(record.ID);
  await PasswordResetTokenModel.invalidateAllForUser(record.USERID);
}

module.exports = { requestPasswordReset, validateResetToken, resetPassword };