import { ZodError } from 'zod';

/**
 * Express middleware that validates req.body against a Zod schema.
 * Returns 400 with structured errors on failure.
 */
export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.errors || error.issues || [];
      const messages = issues.map((e) => ({
        field: e.path?.join('.') || 'unknown',
        message: e.message,
      }));
      return res.status(400).json({ message: 'Validation failed', errors: messages });
    }
    next(error);
  }
};
