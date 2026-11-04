export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export const badRequest = (message, errors) => new HttpError(400, message, errors);
export const forbidden = (message = 'You do not have permission to do this.') => new HttpError(403, message);
export const notFound = (entity = 'Record') => new HttpError(404, `${entity} not found.`);
export const conflict = (message, errors) => new HttpError(409, message, errors);

export const ok = (res, data, message = 'OK', meta) =>
  res.json({ success: true, message, data, ...(meta && { meta }) });

export const created = (res, data, message = 'Created') =>
  res.status(201).json({ success: true, message, data });
