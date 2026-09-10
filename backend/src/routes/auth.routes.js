const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// Limit brute-force attempts on login/signup.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Keep brute-force protection in production while avoiding an unnecessary
  // local-development lockout during repeated UI/API testing.
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  message: { message: 'Too many login attempts. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;
