/**
 * Role-based access control middleware.
 * Must be used AFTER the `protect` middleware (req.user must be set).
 *
 * Usage: router.get('/admin-only', protect, requireRole('Admin'), handler)
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }

    next();
  };
};
