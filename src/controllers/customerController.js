import Customer from '../models/customerModel.js';
import { ok, created, notFound } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { branchScope } from '../middleware/auth.js';

const customerController = {
  list: async (req, res) => {
    const page = paginate(req.valid.query);
    const { rows, total } = await Customer.list({ ...req.valid.query, ...page });
    ok(res, rows, 'Customers fetched.', pageMeta(page, total));
  },

  get: async (req, res) => {
    const customer = await Customer.getById(req.valid.params.id);
    if (!customer) throw notFound('Customer');
    ok(res, customer);
  },

  history: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Customer.getById(id))) throw notFound('Customer');
    ok(res, await Customer.history(id, branchScope(req)));
  },

  create: async (req, res) => {
    const id = await Customer.create(req.valid.body);
    await audit(req, 'create', 'customer', id);
    created(res, await Customer.getById(id), 'Customer added.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Customer.getById(id))) throw notFound('Customer');
    await Customer.update(id, req.valid.body);
    await audit(req, 'update', 'customer', id);
    ok(res, await Customer.getById(id), 'Customer updated.');
  },

  deactivate: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Customer.getById(id))) throw notFound('Customer');
    await Customer.setActive(id, false);
    await audit(req, 'deactivate', 'customer', id);
    ok(res, { customer_id: id }, 'Customer archived. Their purchase history is kept.');
  },
};

export default customerController;
