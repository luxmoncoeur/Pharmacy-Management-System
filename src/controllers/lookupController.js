import { z } from 'zod';
import { Category, Supplier } from '../models/lookupModel.js';
import { ok, created, notFound, conflict } from '../utils/http.js';
import { audit } from '../utils/audit.js';

export const categoryController = {
  list: async (_req, res) => ok(res, await Category.list()),

  create: async (req, res) => {
    const id = await Category.create(req.valid.body);
    await audit(req, 'create', 'category', id);
    created(res, await Category.getById(id), 'Category added.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Category.getById(id))) throw notFound('Category');
    await Category.update(id, req.valid.body);
    await audit(req, 'update', 'category', id);
    ok(res, await Category.getById(id), 'Category renamed.');
  },

  remove: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Category.getById(id))) throw notFound('Category');
    try {
      await Category.remove(id);
    } catch (err) {
      if (err.code?.startsWith('ER_ROW_IS_REFERENCED')) throw conflict('Move this category\'s medicines to another category first.');
      throw err;
    }
    await audit(req, 'delete', 'category', id);
    ok(res, { category_id: id }, 'Category deleted.');
  },
};

const supplierQuery = z.object({ status: z.enum(['active', 'inactive', 'all']).default('active') });

export const supplierController = {
  list: async (req, res) => ok(res, await Supplier.list(supplierQuery.parse(req.query).status)),

  get: async (req, res) => {
    const s = await Supplier.getById(req.valid.params.id);
    if (!s) throw notFound('Supplier');
    ok(res, s);
  },

  create: async (req, res) => {
    const id = await Supplier.create(req.valid.body);
    await audit(req, 'create', 'supplier', id);
    created(res, await Supplier.getById(id), 'Supplier added.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Supplier.getById(id))) throw notFound('Supplier');
    await Supplier.update(id, req.valid.body);
    await audit(req, 'update', 'supplier', id);
    ok(res, await Supplier.getById(id), 'Supplier updated.');
  },

  deactivate: async (req, res) => {
    const { id } = req.valid.params;
    if (!(await Supplier.getById(id))) throw notFound('Supplier');
    await Supplier.setActive(id, false);
    await audit(req, 'deactivate', 'supplier', id);
    ok(res, { supplier_id: id }, 'Supplier deactivated.');
  },
};
