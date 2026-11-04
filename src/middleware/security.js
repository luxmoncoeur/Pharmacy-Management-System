import rateLimit from 'express-rate-limit';
import { forbidden } from '../utils/http.js';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many failed sign-in attempts. Try again in 15 minutes.' },
});

/** Blocks cross-site form posts. Same-origin fetch calls always send a matching Origin header (or none). */
export function sameOriginOnly(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin && new URL(origin).host !== req.get('host')) throw forbidden('Cross-site requests are not allowed.');
  next();
}
