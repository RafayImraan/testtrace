/** Auth routes: /api/auth/*  (login is rate limited against brute force) */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { z, email, password } = require('../validators/common');
const ctrl = require('../controllers/authController');

const loginLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many login attempts. Please wait and try again.',
      code: 'RATE_LIMITED',
    },
  },
});

router.post(
  '/login',
  loginLimiter,
  validate({ body: z.object({ email, password: z.string().min(1) }) }),
  ctrl.login
);

router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.patch(
  '/profile',
  authenticate,
  validate({ body: z.object({ fullName: z.string().trim().min(2).max(120).optional(), avatarColor: z.string().max(9).optional() }) }),
  ctrl.updateProfile
);
router.post(
  '/password',
  authenticate,
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: password }) }),
  ctrl.changePassword
);

module.exports = router;
