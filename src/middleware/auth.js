import { query } from '../config/db.js';
import { HttpError, forbidden } from '../utils/http.js';

/** Re-reads the user on every request so deactivation or a role change takes effect immediately. */
export async function requireAuth(req, _res, next) {
  const sessionUser = req.session?.user;
  if (!sessionUser) throw new HttpError(401, 'Please sign in to continue.');

  const [user] = await query(
    `SELECT u.user_id, u.username, u.full_name, u.role, u.branch_id, u.is_active, b.name AS branch_name,
            p.pharmacist_id
       FROM tbl_users u
       LEFT JOIN tbl_branches b ON b.branch_id = u.branch_id
       LEFT JOIN tbl_pharmacists p ON p.user_id = u.user_id
      WHERE u.user_id = ?`,
    [sessionUser.user_id],
  );
  if (!user || !user.is_active) {
    req.session.destroy(() => {});
    throw new HttpError(401, 'Your account is no longer active.');
  }
  delete user.is_active;
  req.session.user = user;
  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw forbidden();
  next();
};

/**
 * Resolves which branch a request may see. Admins may pick any branch (or all, when none is given);
 * everyone else is pinned to their own branch whatever they ask for.
 */
export function branchScope(req, requested) {
  if (req.user.role === 'admin') return requested ?? null;
  return req.user.branch_id;
}

export function assertBranchAccess(req, branchId) {
  if (req.user.role !== 'admin' && Number(branchId) !== Number(req.user.branch_id)) {
    throw forbidden('This record belongs to another branch.');
  }
}
