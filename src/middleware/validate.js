import { badRequest } from '../utils/http.js';

const toFieldErrors = (issues) => {
  const errors = {};
  for (const issue of issues) {
    const field = issue.path.join('.') || '_';
    errors[field] ??= issue.message;
  }
  return errors;
};

/**
 * Validates request parts against zod schemas and stores the parsed (coerced, trimmed) values on req.valid.
 * Express 5 makes req.query read-only, so handlers read from req.valid instead.
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      throw badRequest('Some fields need attention.', toFieldErrors(result.error.issues));
    }
    req.valid[part] = result.data;
  }
  next();
};
