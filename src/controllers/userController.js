import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import { ok, created, notFound, conflict, forbidden } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { isOwner } from '../middleware/auth.js';

const ownerAccount = (u) => u.role === 'manager' && !u.branch_id;

const userController = {
  list: async (req, res) => {
    const filters = { ...req.valid.query };
    if (!isOwner(req.user)) filters.branch = req.user.branch_id;
    const page = paginate(filters);
    const { rows, total } = await User.list({ ...filters, ...page });
    ok(res, rows, 'Staff fetched.', pageMeta(page, total));
  },

  get: async (req, res) => {
    const user = await User.getById(req.valid.params.id);
    if (!user) throw notFound('Staff account');
    if (!isOwner(req.user) && user.branch_id !== req.user.branch_id) throw forbidden('This account belongs to another branch.');
    ok(res, user);
  },

  create: async (req, res) => {
    const body = req.valid.body;
    const id = await User.create(body, await bcrypt.hash(body.password, 10));
    created(res, await User.getById(id), 'Staff account created.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    const body = req.valid.body;
    const existing = await User.getById(id);
    if (!existing) throw notFound('Staff account');
    const losingOwner = ownerAccount(existing) && existing.is_active && (!ownerAccount(body) || body.is_active === false);
    if (losingOwner && (await User.countActiveOwners()) <= 1) {
      throw conflict('At least one active owner (a manager with no branch) is required.');
    }
    await User.update(id, body);
    if (body.password) await User.setPassword(id, await bcrypt.hash(body.password, 10));
    ok(res, await User.getById(id), 'Staff account updated.');
  },

  deactivate: async (req, res) => {
    const { id } = req.valid.params;
    const existing = await User.getById(id);
    if (!existing) throw notFound('Staff account');
    if (id === req.user.user_id) throw conflict('You cannot deactivate your own account.');
    if (ownerAccount(existing) && (await User.countActiveOwners()) <= 1) throw conflict('At least one active owner is required.');
    await User.setActive(id, false);
    ok(res, { user_id: id }, 'Staff account deactivated. Their sales history is kept.');
  },
};

export default userController;
