import { ZodError } from 'zod';

/**
 * Express middleware that validates req.body against a Zod schema.
 * Returns 400 with structured errors on failure.
 */
const toValidationResponse = (error) => {
  const issues = error.errors || error.issues || [];
  return {
    message: 'Validation failed',
    errors: issues.map((e) => ({
      field: e.path?.join('.') || 'unknown',
      message: e.message,
    })),
  };
};

export const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(toValidationResponse(error));
    }
    next(error);
  }
};

/**
 * Validates req.query against a Zod schema.
 *
 * The parsed result is written to `req.validated.query` rather than back onto
 * `req.query` — under Express 5 `req.query` is a getter-only property and
 * assigning to it throws.
 */
export const validateQuery = (schema) => (req, res, next) => {
  try {
    req.validated = { ...(req.validated || {}), query: schema.parse(req.query) };
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json(toValidationResponse(error));
    }
    next(error);
  }
};
