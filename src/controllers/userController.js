import bcrypt from 'bcryptjs';
import User from '../models/userModel.js';
import { ok, created, notFound, conflict, forbidden } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';

const userController = {
  list: async (req, res) => {
    const filters = { ...req.valid.query };
    if (req.user.role === 'manager') filters.branch = req.user.branch_id;
    const page = paginate(filters);
    const { rows, total } = await User.list({ ...filters, ...page });
    ok(res, rows, 'Users fetched.', pageMeta(page, total));
  },

  get: async (req, res) => {
    const user = await User.getById(req.valid.params.id);
    if (!user) throw notFound('User');
    if (req.user.role === 'manager' && user.branch_id !== req.user.branch_id) throw forbidden('This user belongs to another branch.');
    ok(res, user);
  },

  create: async (req, res) => {
    const body = req.valid.body;
    const id = await User.create(body, await bcrypt.hash(body.password, 10));
    await audit(req, 'create', 'user', id, { username: body.username, role: body.role });
    created(res, await User.getById(id), 'User account created.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    const body = req.valid.body;
    const existing = await User.getById(id);
    if (!existing) throw notFound('User');
    const losingAdmin = existing.role === 'admin' && existing.is_active && (body.role !== 'admin' || body.is_active === false);
    if (losingAdmin && (await User.countActiveAdmins()) <= 1) {
      throw conflict('At least one active administrator is required.');
    }
    await User.update(id, body);
    if (body.password) await User.setPassword(id, await bcrypt.hash(body.password, 10));
    await audit(req, 'update', 'user', id, { role: body.role, is_active: body.is_active, password_reset: Boolean(body.password) });
    ok(res, await User.getById(id), 'User updated.');
  },

  deactivate: async (req, res) => {
    const { id } = req.valid.params;
    const existing = await User.getById(id);
    if (!existing) throw notFound('User');
    if (id === req.user.user_id) throw conflict('You cannot deactivate your own account.');
    if (existing.role === 'admin' && (await User.countActiveAdmins()) <= 1) throw conflict('At least one active administrator is required.');
    await User.setActive(id, false);
    await audit(req, 'deactivate', 'user', id);
    ok(res, { user_id: id }, 'User deactivated. Their sales history is kept.');
  },
};

export default userController;
