import { withTransaction, query } from '../config/db.js';
import Inventory from '../models/inventoryModel.js';
import { moveStock } from '../services/inventoryService.js';
import { ok, created, notFound, conflict, badRequest, forbidden } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { branchScope, assertBranchAccess, targetBranch } from '../middleware/auth.js';

const inventoryController = {
  listBatches: async (req, res) => {
    const page = paginate(req.valid.query);
    const { rows, total } = await Inventory.listBatches({ ...req.valid.query, ...page }, branchScope(req, req.valid.query.branch));
    ok(res, rows, 'Batches fetched.', pageMeta(page, total));
  },

  getBatch: async (req, res) => {
    const batch = await Inventory.getBatch(req.valid.params.id);
    if (!batch) throw notFound('Batch');
    assertBranchAccess(req, batch.branch_id);
    ok(res, batch);
  },

  receive: async (req, res) => {
    const body = req.valid.body;
    const branchId = targetBranch(req, body.branch_id);
    if (!branchId) throw badRequest('Choose the branch receiving this stock.', { branch_id: 'Branch is required.' });

    const [medicine] = await query('SELECT is_active FROM tbl_medicines WHERE medicine_id = ?', [body.medicine_id]);
    if (!medicine) throw badRequest('Medicine does not exist.', { medicine_id: 'Choose an existing medicine.' });
    if (!medicine.is_active) throw conflict('This medicine is archived. Restore it before receiving stock.');

    const batchId = await withTransaction(async (conn) => {
      const [r] = await conn.query(
        `INSERT INTO tbl_batches (medicine_id, branch_id, supplier, batch_no, expiry_date, cost_price, qty_on_hand)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
        [body.medicine_id, branchId, body.supplier ?? null, body.batch_no, body.expiry_date, body.cost_price],
      );
      await moveStock(conn, {
        batchId: r.insertId, userId: req.user.user_id, type: 'receive', qtyChange: body.quantity, refType: 'batch', refId: r.insertId,
      });
      return r.insertId;
    });
    created(res, await Inventory.getBatch(batchId), `Received ${body.quantity} units.`);
  },

  updateBatch: async (req, res) => {
    const { id } = req.valid.params;
    const batch = await Inventory.getBatch(id);
    if (!batch) throw notFound('Batch');
    assertBranchAccess(req, batch.branch_id);
    await Inventory.updateBatch(id, req.valid.body);
    ok(res, await Inventory.getBatch(id), 'Batch details updated.');
  },

  adjust: async (req, res) => {
    const { id } = req.valid.params;
    const { type, qty_change, reason } = req.valid.body;
    if (type === 'write_off' && qty_change > 0) throw badRequest('Removing stock takes units away.', { qty_change: 'Enter a negative quantity to remove stock.' });
    // Pharmacists may remove expired or damaged stock; count corrections (which can add units) need a manager.
    if (type === 'adjust' && req.user.role !== 'manager') throw forbidden('Only a manager can record a count correction.');

    await withTransaction(async (conn) => {
      const [[batch]] = await conn.query('SELECT batch_id, branch_id, qty_on_hand FROM tbl_batches WHERE batch_id = ? FOR UPDATE', [id]);
      if (!batch) throw notFound('Batch');
      assertBranchAccess(req, batch.branch_id);
      if (batch.qty_on_hand + qty_change < 0) {
        throw conflict(`Only ${batch.qty_on_hand} units are on hand in this batch.`, { qty_change: `Cannot remove more than ${batch.qty_on_hand}.` });
      }
      await moveStock(conn, { batchId: id, userId: req.user.user_id, type, qtyChange: qty_change, refType: 'batch', refId: id, reason });
    });
    ok(res, await Inventory.getBatch(id), type === 'write_off' ? 'Stock removed.' : 'Stock count corrected.');
  },

  alerts: async (req, res) => ok(res, await Inventory.alerts(branchScope(req, req.valid.query?.branch))),

  reorder: async (req, res) => ok(res, await Inventory.reorder(branchScope(req, req.valid.query?.branch))),

  movements: async (req, res) => {
    const page = paginate(req.valid.query);
    const { rows, total } = await Inventory.movements({ ...req.valid.query, ...page }, branchScope(req, req.valid.query.branch));
    ok(res, rows, 'Stock movements fetched.', pageMeta(page, total));
  },
};

export default inventoryController;
