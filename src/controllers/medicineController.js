import Medicine from '../models/medicineModel.js';
import { ok, created, notFound } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { branchScope } from '../middleware/auth.js';

const medicineController = {
  list: async (req, res) => {
    const page = paginate(req.valid.query);
    const { rows, total } = await Medicine.list({ ...req.valid.query, ...page }, branchScope(req, req.valid.query.branch));
    ok(res, rows, 'Medicines fetched.', pageMeta(page, total));
  },

  get: async (req, res) => {
    const { id } = req.valid.params;
    const medicine = await Medicine.getById(id, branchScope(req, req.valid.query?.branch));
    if (!medicine) throw notFound('Medicine');
    ok(res, { ...medicine, branches: await Medicine.stockByBranch(id) });
  },

  byBarcode: async (req, res) => {
    const medicine = await Medicine.findByBarcode(String(req.params.code).trim(), branchScope(req));
    if (!medicine) throw notFound('No medicine with this barcode');
    ok(res, medicine);
  },

  create: async (req, res) => {
    const id = await Medicine.create(req.valid.body);
    await audit(req, 'create', 'medicine', id, { name: `${req.valid.body.generic_name} (${req.valid.body.brand})` });
    created(res, await Medicine.getById(id), 'Medicine added.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    const before = await Medicine.getById(id);
    if (!before) throw notFound('Medicine');
    await Medicine.update(id, req.valid.body);
    const priceChanged = Number(before.price) !== req.valid.body.price;
    await audit(req, priceChanged ? 'price_change' : 'update', 'medicine', id,
      priceChanged ? { from: Number(before.price), to: req.valid.body.price } : null);
    ok(res, await Medicine.getById(id), 'Medicine updated.');
  },

  deactivate: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Medicine.getById(id))) throw notFound('Medicine');
    await Medicine.setActive(id, false);
    await audit(req, 'deactivate', 'medicine', id);
    ok(res, { medicine_id: id }, 'Medicine archived. It no longer appears at the POS.');
  },
};

export default medicineController;
