import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

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

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      authProvider: user.authProvider,
      token: generateToken(user._id),
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
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      authProvider: user.authProvider,
      token: generateToken(user._id),
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
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      authProvider: updatedUser.authProvider,
      token: generateToken(updatedUser._id),
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

    // In production, send this token via email.
    // For now, return the token in the response (dev only).
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    res.json({
      message: 'If an account with that email exists, a reset link has been generated.',
      // DEV ONLY — remove in production
      ...(process.env.NODE_ENV !== 'production' && { resetToken, resetUrl }),
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

    res.json({
      message: 'Password reset successful',
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/auth/google/callback
 * @desc    Handle Google OAuth callback — generate JWT and redirect to frontend
 */
export const googleCallback = (req, res) => {
  try {
    const user = req.user;
    const token = generateToken(user._id);

    // Build user data to pass to the frontend via URL params
    const userData = encodeURIComponent(
      JSON.stringify({
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        authProvider: user.authProvider,
      })
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${userData}`);
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?error=oauth_failed`);
  }
};
