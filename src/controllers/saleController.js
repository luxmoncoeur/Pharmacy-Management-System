import Sale from '../models/saleModel.js';
import { checkout, voidSale } from '../services/checkoutService.js';
import { ok, created, notFound } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { branchScope, assertBranchAccess } from '../middleware/auth.js';

const saleController = {
  list: async (req, res) => {
    const filters = { ...req.valid.query };
    if (req.user.role === 'cashier') filters.cashier = req.user.user_id;
    const page = paginate(filters);
    const { rows, total, revenue } = await Sale.list({ ...filters, ...page }, branchScope(req, filters.branch));
    ok(res, rows, 'Sales fetched.', { ...pageMeta(page, total), revenue });
  },

  get: async (req, res) => {
    const sale = await Sale.getById(req.valid.params.id);
    if (!sale) throw notFound('Sale');
    assertBranchAccess(req, sale.branch_id);
    ok(res, sale);
  },

  create: async (req, res) => {
    const saleId = await checkout(req, req.valid.body);
    const sale = await Sale.getById(saleId);
    created(res, sale, `Sale ${sale.receipt_no} completed.`);
  },

  void: async (req, res) => {
    const saleId = await voidSale(req, req.valid.params.id, req.valid.body.reason);
    if (!saleId) throw notFound('Sale');
    ok(res, await Sale.getById(saleId), 'Sale voided. Stock was returned to its original batches.');
  },
};

export default saleController;
