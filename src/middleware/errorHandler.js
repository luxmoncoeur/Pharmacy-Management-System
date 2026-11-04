import { HttpError } from '../utils/http.js';

// Maps unique-key names from schema.sql to the field and message the form should show.
const DUPLICATE_KEYS = {
  uq_branch_name: ['name', 'A branch with this name already exists.'],
  uq_username: ['username', 'This username is already taken.'],
  uq_pharmacist_user: ['user_id', 'This user is already linked to a pharmacist.'],
  uq_pharmacist_license: ['license_no', 'This license number is already registered.'],
  uq_pharmacist_email: ['email', 'This email is already registered.'],
  uq_customer_email: ['email', 'A customer with this email already exists.'],
  uq_category_name: ['name', 'This category already exists.'],
  uq_supplier_name: ['name', 'A supplier with this name already exists.'],
  uq_medicine_identity: ['generic_name', 'This medicine (same generic name, brand, strength and form) already exists.'],
  uq_medicine_barcode: ['barcode', 'Another medicine already uses this barcode.'],
  uq_batch: ['batch_no', 'This batch number was already received for this medicine at this branch.'],
  uq_rx_medicine: ['items', 'A medicine can only appear once per prescription.'],
};

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `No API route for ${req.method} ${req.originalUrl}.` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message, ...(err.errors && { errors: err.errors }) });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'The request body is not valid JSON.' });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    const key = Object.keys(DUPLICATE_KEYS).find((k) => err.message.includes(k));
    const [field, message] = DUPLICATE_KEYS[key] ?? ['_', 'This record already exists.'];
    return res.status(409).json({ success: false, message, errors: { [field]: message } });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ success: false, message: 'This record is used by other records. Deactivate it instead.' });
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({ success: false, message: 'A linked record does not exist.' });
  }
  if (err.code === 'ER_CONSTRAINT_FAILED' || err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    return res.status(400).json({ success: false, message: 'A value is outside the allowed range.' });
  }

  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ success: false, message: 'Something went wrong on the server. Please try again.' });
}
