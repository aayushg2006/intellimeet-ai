/**
 * Strips MongoDB operator keys from user input.
 *
 * Without this, a body like `{ "email": { "$ne": null } }` reaches Mongoose as
 * a query operator rather than a value. We deliberately do NOT use
 * `express-mongo-sanitize`: it reassigns `req.query`, which is a getter-only
 * property in Express 5 and throws on every request.
 *
 * Keys are removed rather than escaped so the shape a validator sees is the
 * shape the database sees.
 */

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const MAX_DEPTH = 10;

const scrub = (value, depth = 0) => {
  if (depth > MAX_DEPTH) return 0;

  let removed = 0;

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (isPlainObject(entry) || Array.isArray(entry)) removed += scrub(entry, depth + 1);
    }
    return removed;
  }

  if (!isPlainObject(value)) return 0;

  for (const key of Object.keys(value)) {
    // `$` starts an operator; `.` allows reaching into nested paths.
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      removed += 1;
      continue;
    }
    const child = value[key];
    if (isPlainObject(child) || Array.isArray(child)) removed += scrub(child, depth + 1);
  }

  return removed;
};

export const sanitizeRequest = (req, _res, next) => {
  let removed = 0;

  // Mutate in place — `req.query` cannot be reassigned under Express 5.
  for (const source of [req.body, req.params, req.query]) {
    if (source) removed += scrub(source);
  }

  if (removed > 0) {
    console.warn(`[Sanitize] Removed ${removed} operator key(s) from ${req.method} ${req.originalUrl}`);
  }

  next();
};

export default sanitizeRequest;
