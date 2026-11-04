import { api } from './api.js';

export const session = { user: null };

export async function loadSession() {
  const res = await api.get('/auth/me');
  session.user = res.data;
  return session.user;
}

export const role = () => session.user?.role;
export const can = (...roles) => roles.includes(session.user?.role);
export const isAdmin = () => role() === 'admin';
export const hasBranch = () => Boolean(session.user?.branch_id);

export const ROLES = {
  ALL: ['admin', 'manager', 'pharmacist', 'cashier'],
  MANAGEMENT: ['admin', 'manager'],
  DISPENSING: ['admin', 'manager', 'pharmacist'],
  SELLING: ['manager', 'pharmacist', 'cashier'],
};
