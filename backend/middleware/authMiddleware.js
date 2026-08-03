import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      return next();
    } catch (error) {
      console.error(`Auth Error: ${error.message}`);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Populates req.user when a valid token is present, but never rejects.
 *
 * Used by endpoints that behave slightly differently for a signed-in user but
 * must still work without one — logout being the obvious case, where the access
 * token has usually already expired by the time the user clicks it.
 */
export const optionalAuth = async (req, _res, next) => {
  const header = req.headers.authorization;

  if (header?.startsWith('Bearer')) {
    try {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch {
      // An invalid or expired token is simply treated as "not signed in".
    }
  }

  next();
};
