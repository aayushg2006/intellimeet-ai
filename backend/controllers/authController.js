import User from '../models/User.js';
import crypto from 'crypto';
import { checkAndJoinOrganizationByDomain } from '../utils/orgUtils.js';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  createAuthCode,
  consumeAuthCode,
  generateAccessToken,
} from '../services/tokenService.js';
import { sendPasswordResetEmail, isEmailEnabled } from '../services/emailService.js';

/** Shape a user document for a client response. Never includes secrets. */
const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  authProvider: user.authProvider,
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user with email/password
 */
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists with this email');
    }

    const user = await User.create({
      name,
      email,
      password,
      authProvider: 'local',
    });

    // Auto-join organization if domain matches
    await checkAndJoinOrganizationByDomain(user);

    res.status(201).json({
      ...publicUser(user),
      ...(await issueTokenPair(user._id, req)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user with email/password
 */
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    // If user registered via Google only, they can't use password login
    if (user.authProvider === 'google' && !user.password) {
      res.status(401);
      throw new Error('This account uses Google Sign-In. Please log in with Google.');
    }

    if (!(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    res.json({
      ...publicUser(user),
      ...(await issueTokenPair(user._id, req)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/refresh
 * @desc    Exchange a refresh token for a new access token (rotates the refresh token)
 */
export const refreshSession = async (req, res, next) => {
  try {
    const result = await rotateRefreshToken(req.body.refreshToken, req);

    if (!result.ok) {
      return res.status(401).json({ message: result.reason });
    }

    const user = await User.findById(result.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    res.json({
      ...publicUser(user),
      token: result.token,
      refreshToken: result.refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke the presented refresh token (or all of the user's sessions)
 */
export const logout = async (req, res, next) => {
  try {
    if (req.body.allDevices && req.user) {
      await revokeAllForUser(req.user._id);
    } else {
      await revokeRefreshToken(req.body.refreshToken);
    }
    res.json({ message: 'Logged out' });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/oauth/exchange
 * @desc    Redeem the one-time code from the Google callback for real tokens
 */
export const exchangeAuthCode = async (req, res, next) => {
  try {
    const userId = await consumeAuthCode(req.body.code);
    if (!userId) {
      return res.status(400).json({ message: 'Invalid or expired sign-in code' });
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired sign-in code' });
    }

    res.json({
      ...publicUser(user),
      ...(await issueTokenPair(user._id, req)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-password -resetPasswordToken -resetPasswordExpires');

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      authProvider: user.authProvider,
      createdAt: user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile (name, avatar)
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    if (req.body.name) user.name = req.body.name;
    if (req.body.avatar !== undefined) user.avatar = req.body.avatar;

    const updatedUser = await user.save();

    res.json({
      ...publicUser(updatedUser),
      // A profile edit is not a re-authentication, but the client keeps the
      // token alongside the user object, so hand back a fresh access token.
      token: generateAccessToken(updatedUser._id),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Generate password reset token
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal whether the email exists — return success either way
      return res.json({ message: 'If an account with that email exists, a reset link has been generated.' });
    }

    if (user.authProvider === 'google' && !user.password) {
      return res.json({ message: 'This account uses Google Sign-In. No password to reset.' });
    }

    const resetToken = user.generateResetToken();
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Previously the token was only ever returned in the response body when
    // NODE_ENV !== 'production', which meant password reset was completely
    // unusable on the deployed instance — the user got a success message and no
    // way to actually reset.
    await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl });

    res.json({
      message: 'If an account with that email exists, a reset link has been sent.',
      // Only when no mail provider is configured, so the flow stays testable
      // locally. With RESEND_API_KEY set, the token never leaves the server.
      ...(!isEmailEnabled() && { resetToken, resetUrl, emailConfigured: false }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      res.status(400);
      throw new Error('Invalid or expired reset token');
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // If user was Google-only, now they have both
    if (user.authProvider === 'google') {
      user.authProvider = 'both';
    }

    await user.save();

    // A password reset should end every existing session — that is the whole
    // point when the reset was triggered because the account was compromised.
    await revokeAllForUser(user._id);

    res.json({
      message: 'Password reset successful',
      ...publicUser(user),
      ...(await issueTokenPair(user._id, req)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback — generate JWT and redirect to frontend
 */
export const googleCallback = async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    // Redirect with a single-use, 60-second code rather than the JWT itself.
    // A token in the query string ends up in browser history, the Referer
    // header of the next outbound request, and any intermediate proxy log.
    const code = await createAuthCode(req.user._id);
    res.redirect(`${frontendUrl}/auth/callback?code=${encodeURIComponent(code)}`);
  } catch (error) {
    console.error('[Auth] Google callback failed:', error.message);
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
};
