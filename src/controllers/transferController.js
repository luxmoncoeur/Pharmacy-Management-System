import { withTransaction, query } from '../config/db.js';
import Transfer from '../models/transferModel.js';
import { dispatchTransfer, receiveTransfer, cancelTransfer } from '../services/transferService.js';
import { ok, created, notFound, forbidden, badRequest } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { branchScope } from '../middleware/auth.js';

const transferController = {
  list: async (req, res) => {
    const page = paginate(req.valid.query);
    const { rows, total } = await Transfer.list({ ...req.valid.query, ...page }, branchScope(req, req.valid.query.branch));
    ok(res, rows, 'Transfers fetched.', pageMeta(page, total));
  },

  get: async (req, res) => {
    const t = await Transfer.getById(req.valid.params.id);
    if (!t) throw notFound('Transfer');
    if (req.user.role !== 'admin' && ![t.from_branch_id, t.to_branch_id].includes(req.user.branch_id)) throw forbidden('This transfer does not involve your branch.');
    ok(res, t);
  },

  create: async (req, res) => {
    const body = req.valid.body;
    if (req.user.role !== 'admin' && ![body.from_branch_id, body.to_branch_id].includes(req.user.branch_id)) {
      throw forbidden('A transfer must involve your own branch.');
    }
    const branches = await query('SELECT branch_id FROM tbl_branches WHERE is_active = 1 AND branch_id IN (?)', [[body.from_branch_id, body.to_branch_id]]);
    if (branches.length !== 2) throw badRequest('Both branches must be active.', { to_branch_id: 'Choose an active branch.' });
    const meds = await query('SELECT medicine_id FROM tbl_medicines WHERE is_active = 1 AND medicine_id IN (?)', [body.items.map((i) => i.medicine_id)]);
    if (meds.length !== body.items.length) throw badRequest('One or more medicines are archived or unknown.', { items: 'Remove archived medicines.' });

    const id = await withTransaction(async (conn) => {
      const [r] = await conn.query(
        'INSERT INTO tbl_transfers (from_branch_id, to_branch_id, notes, requested_by) VALUES (?, ?, ?, ?)',
        [body.from_branch_id, body.to_branch_id, body.notes ?? null, req.user.user_id],
      );
      await conn.query('INSERT INTO tbl_transfer_items (transfer_id, medicine_id, quantity) VALUES ?', [body.items.map((i) => [r.insertId, i.medicine_id, i.quantity])]);
      await audit(req, 'create', 'transfer', r.insertId, null, conn);
      return r.insertId;
    });
    created(res, await Transfer.getById(id), 'Transfer requested.');
  },

  dispatch: async (req, res) => {
    await dispatchTransfer(req, req.valid.params.id);
    ok(res, await Transfer.getById(req.valid.params.id), 'Transfer dispatched. Stock left this branch.');
  },

  receive: async (req, res) => {
    await receiveTransfer(req, req.valid.params.id);
    ok(res, await Transfer.getById(req.valid.params.id), 'Transfer received. Stock was added to this branch.');
  },

  cancel: async (req, res) => {
    await cancelTransfer(req, req.valid.params.id);
    ok(res, await Transfer.getById(req.valid.params.id), 'Transfer cancelled.');
  },
};

export default transferController;
