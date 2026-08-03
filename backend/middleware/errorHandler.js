/**
 * Global error handling middleware.
 * Catches all unhandled errors and returns a consistent JSON response.
 * Must be registered AFTER all routes in Express.
 */
// Fail safe: only expose internals when explicitly running in development.
// The previous `!== 'production'` check leaked stack traces to clients on any
// host where NODE_ENV happened to be unset.
const isDevelopment = () => process.env.NODE_ENV === 'development';

const errorHandler = (err, req, res, _next) => {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err.message);
  if (isDevelopment()) {
    console.error(err.stack);
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  // Never surface raw driver/internal messages on a 500 — they routinely
  // contain collection names, connection strings and query shapes.
  const clientMessage =
    statusCode >= 500 && !isDevelopment()
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    message: clientMessage,
    ...(isDevelopment() && { stack: err.stack }),
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
