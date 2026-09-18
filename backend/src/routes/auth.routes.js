// const express = require('express');
// const rateLimit = require('express-rate-limit');
// const authController = require('../controllers/auth.controller');
// const { requireAuth } = require('../middleware/auth.middleware');

// const router = express.Router();

// // Limit brute-force attempts on login/signup.
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   // Keep brute-force protection in production while avoiding an unnecessary
//   // local-development lockout during repeated UI/API testing.
//   max: process.env.NODE_ENV === 'production' ? 20 : 100,
//   message: { message: 'Too many login attempts. Please wait before trying again.' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// router.post('/signup', authLimiter, authController.signup);
// router.post('/login', authLimiter, authController.login);
// router.post('/refresh', authController.refresh);
// router.post('/logout', authController.logout);
// router.get('/me', requireAuth, authController.me);

// module.exports = router;

const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const passwordResetController = require('../controllers/passwordReset.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 100,
  message: { message: 'Too many login attempts. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limit for password-reset requests — sends email, must not be
// usable to spam an inbox or hammer the mail provider.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: { message: 'Too many reset requests. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

router.post('/forgot-password', forgotPasswordLimiter, passwordResetController.forgotPassword);
router.get('/reset-password/:token/validate', passwordResetController.validateResetToken);
router.post('/reset-password', authLimiter, passwordResetController.resetPassword);

module.exports = router;
