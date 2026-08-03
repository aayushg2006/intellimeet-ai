import express from 'express';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
  resetPassword,
  googleCallback,
  refreshSession,
  logout,
  exchangeAuthCode,
} from '../controllers/authController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.js';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshSchema,
  logoutSchema,
  authCodeSchema,
} from '../validators/schemas.js';

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many attempts from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: 'Too many password reset attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Local Auth ───
router.post('/register', authLimiter, validate(registerSchema), registerUser);
router.post('/login', authLimiter, validate(loginSchema), loginUser);

// ─── Session lifecycle ───
// Deliberately on its own, looser limiter: a browser with several tabs open can
// legitimately refresh a few times in quick succession, and being locked out of
// refresh means being logged out.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: 'Too many refresh attempts, please sign in again' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/refresh', refreshLimiter, validate(refreshSchema), refreshSession);
router.post('/logout', optionalAuth, validate(logoutSchema), logout);
router.post('/oauth/exchange', authLimiter, validate(authCodeSchema), exchangeAuthCode);

// ─── Profile ───
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, validate(updateProfileSchema), updateUserProfile);

// ─── Password Reset ───
router.post('/forgot-password', resetLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', resetLimiter, validate(resetPasswordSchema), resetPassword);

// ─── Google OAuth ───
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: '/login?error=oauth_failed',
  }),
  googleCallback
);

export default router;
