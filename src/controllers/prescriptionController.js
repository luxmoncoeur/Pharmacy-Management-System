import { withTransaction, query } from '../config/db.js';
import Prescription from '../models/prescriptionModel.js';
import { ok, created, notFound, conflict, badRequest, forbidden } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { phToday } from '../validators/common.js';
import { branchScope, assertBranchAccess, targetBranch } from '../middleware/auth.js';
import { assertRxValid } from '../utils/rxValidity.js';

async function assertReferences({ customer_id, items }) {
  const [customer] = await query('SELECT is_active FROM tbl_customers WHERE customer_id = ?', [customer_id]);
  if (!customer?.is_active) throw badRequest('Choose an active customer.', { customer_id: 'Choose an active customer.' });
  const ids = items.map((i) => i.medicine_id);
  const found = await query('SELECT medicine_id FROM tbl_medicines WHERE is_active = 1 AND medicine_id IN (?)', [ids]);
  if (found.length !== ids.length) throw badRequest('One or more medicines do not exist or are archived.', { items: 'Remove archived or unknown medicines.' });
}

/** Only a pharmacist account with a current PRC license on file may verify or reject a prescription. */
function assertCanReview(req) {
  if (req.user.role !== 'pharmacist' || !req.user.license_no) {
    throw forbidden('Only a pharmacist can verify or reject prescriptions.');
  }
  if (req.user.license_expiry && req.user.license_expiry < phToday()) {
    throw forbidden('Your PRC license on file has expired. Ask the owner to update it before verifying prescriptions.');
  }
}

const markReviewed = (conn, req, id, status, reason = null) => conn.query(
  'UPDATE tbl_prescription SET status = ?, reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE prescription_id = ?',
  [status, req.user.user_id, reason, id],
);

async function loadEditable(req, id) {
  const rx = await Prescription.getById(id);
  if (!rx) throw notFound('Prescription');
  assertBranchAccess(req, rx.branch_id);
  return rx;
}

const prescriptionController = {
  list: async (req, res) => {
    const page = paginate(req.valid.query);
    const { rows, total } = await Prescription.list({ ...req.valid.query, ...page }, branchScope(req, req.valid.query.branch));
    ok(res, rows, 'Prescriptions fetched.', pageMeta(page, total));
  },

  get: async (req, res) => ok(res, await loadEditable(req, req.valid.params.id)),

  create: async (req, res) => {
    const body = req.valid.body;
    const branchId = targetBranch(req, body.branch_id);
    if (!branchId) throw badRequest('Choose the branch for this prescription.', { branch_id: 'Branch is required.' });
    if (body.verify) {
      assertCanReview(req);
      assertRxValid(body.date_issued);
    }
    await assertReferences(body);

    const id = await withTransaction(async (conn) => {
      const [r] = await conn.query(
        `INSERT INTO tbl_prescription (customer_id, branch_id, doctor_name, doctor_license_no, date_issued, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [body.customer_id, branchId, body.doctor_name, body.doctor_license_no, body.date_issued, body.notes ?? null, req.user.user_id],
      );
      await Prescription.insertItems(conn, r.insertId, body.items);
      if (body.verify) {
        await markReviewed(conn, req, r.insertId, 'verified');
      }
      return r.insertId;
    });
    created(res, await Prescription.getById(id), body.verify
      ? 'Prescription saved and verified. It can now be given out at Sell.'
      : 'Prescription saved. A pharmacist needs to check it before it can be given out.');
  },

  update: async (req, res) => {
    const { id } = req.valid.params;
    const body = req.valid.body;
    const rx = await loadEditable(req, id);
    if (rx.status !== 'pending') throw conflict('Only prescriptions waiting for review can be edited.');
    await assertReferences(body);

    await withTransaction(async (conn) => {
      await conn.query(
        'UPDATE tbl_prescription SET customer_id = ?, doctor_name = ?, doctor_license_no = ?, date_issued = ?, notes = ? WHERE prescription_id = ?',
        [body.customer_id, body.doctor_name, body.doctor_license_no, body.date_issued, body.notes ?? null, id],
      );
      await conn.query('DELETE FROM tbl_prescribed_items WHERE prescription_id = ?', [id]);
      await Prescription.insertItems(conn, id, body.items);
    });
    ok(res, await Prescription.getById(id), 'Prescription updated.');
  },

  remove: async (req, res) => {
    const { id } = req.valid.params;
    const rx = await loadEditable(req, id);
    if (rx.status !== 'pending') throw conflict('Reviewed prescriptions are part of the dispensing record and cannot be deleted.');
    await query('DELETE FROM tbl_prescription WHERE prescription_id = ?', [id]);
    ok(res, { prescription_id: id }, 'Prescription deleted.');
  },

  verify: async (req, res) => {
    const { id } = req.valid.params;
    assertCanReview(req);
    const rx = await loadEditable(req, id);
    if (rx.status !== 'pending') throw conflict(`This prescription is already ${rx.status.replace('_', ' ')}.`);
    assertRxValid(rx.date_issued);
    await withTransaction(async (conn) => {
      await markReviewed(conn, req, id, 'verified');
    });
    ok(res, await Prescription.getById(id), 'Prescription verified. It can now be given out at Sell.');
  },

  reject: async (req, res) => {
    const { id } = req.valid.params;
    assertCanReview(req);
    const rx = await loadEditable(req, id);
    if (rx.status !== 'pending') throw conflict(`This prescription is already ${rx.status.replace('_', ' ')}.`);
    await withTransaction(async (conn) => {
      await markReviewed(conn, req, id, 'rejected', req.valid.body.reason);
    });
    ok(res, await Prescription.getById(id), 'Prescription rejected.');
  },
};

export default prescriptionController;
