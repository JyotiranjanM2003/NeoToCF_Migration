/**
 * Thin wrapper around nodemailer. If SMTP_HOST isn't set (e.g. local dev
 * with no mail account configured) we log the message instead of throwing,
 * so the forgot-password flow is still fully testable end-to-end.
 */
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.SMTP_FROM || 'no-reply@neo-cf-migration.local';
  const t = getTransporter();

  if (!t) {
    logger.warn('SMTP not configured — logging email instead of sending it', { to, subject, text });
    return { simulated: true };
  }

  return t.sendMail({ from, to, subject, text, html });
}

module.exports = { sendMail };