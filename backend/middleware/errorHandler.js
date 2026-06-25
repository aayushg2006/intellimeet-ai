/**
 * Global error handling middleware.
 * Catches all unhandled errors and returns a consistent JSON response.
 * Must be registered AFTER all routes in Express.
 */
const errorHandler = (err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Middleware for handling 404 Not Found routes.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found — ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export { errorHandler, notFound };
