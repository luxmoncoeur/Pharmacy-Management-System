import { api } from './api.js';

export const session = { user: null };

export async function loadSession() {
  const res = await api.get('/auth/me');
  session.user = res.data;
  return session.user;
}

export const role = () => session.user?.role;
export const can = (...roles) => roles.includes(session.user?.role);
export const hasBranch = () => Boolean(session.user?.branch_id);
/** The owner is a manager with no branch: they see every branch and manage staff and branches. */
export const isOwner = () => role() === 'manager' && !hasBranch();
/** Selling needs a till, and a till belongs to a branch. */
export const canSell = () => hasBranch();

export const ROLES = {
  ALL: ['manager', 'pharmacist', 'cashier'],
  MANAGEMENT: ['manager'],
  // People who handle stock: receive deliveries and remove expired or damaged stock.
  DISPENSING: ['manager', 'pharmacist'],
};
