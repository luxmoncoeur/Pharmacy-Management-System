import { withTransaction, query } from '../config/db.js';
import Prescription from '../models/prescriptionModel.js';
import { ok, created, notFound, conflict, badRequest, forbidden } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { audit } from '../utils/audit.js';
import { branchScope, assertBranchAccess } from '../middleware/auth.js';

async function assertReferences({ customer_id, items }) {
  const [customer] = await query('SELECT is_active FROM tbl_customers WHERE customer_id = ?', [customer_id]);
  if (!customer?.is_active) throw badRequest('Choose an active customer.', { customer_id: 'Choose an active customer.' });
  const ids = items.map((i) => i.medicine_id);
  const found = await query('SELECT medicine_id FROM tbl_medicines WHERE is_active = 1 AND medicine_id IN (?)', [ids]);
  if (found.length !== ids.length) throw badRequest('One or more medicines do not exist or are archived.', { items: 'Remove archived or unknown medicines.' });
}

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
    const branchId = req.user.role === 'admin' ? body.branch_id : req.user.branch_id;
    if (!branchId) throw badRequest('Choose the branch for this prescription.', { branch_id: 'Branch is required.' });
    await assertReferences(body);

    const id = await withTransaction(async (conn) => {
      const [r] = await conn.query(
        `INSERT INTO tbl_prescription (customer_id, branch_id, doctor_name, doctor_license_no, date_issued, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [body.customer_id, branchId, body.doctor_name, body.doctor_license_no, body.date_issued, body.notes ?? null, req.user.user_id],
      );
      await Prescription.insertItems(conn, r.insertId, body.items);
      await audit(req, 'create', 'prescription', r.insertId, null, conn);
      return r.insertId;
    });
    created(res, await Prescription.getById(id), 'Prescription recorded. It is waiting for pharmacist review.');
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
      await audit(req, 'update', 'prescription', id, null, conn);
    });
    ok(res, await Prescription.getById(id), 'Prescription updated.');
  },

  remove: async (req, res) => {
    const { id } = req.valid.params;
    const rx = await loadEditable(req, id);
    if (rx.status !== 'pending') throw conflict('Reviewed prescriptions are part of the dispensing record and cannot be deleted.');
    await query('DELETE FROM tbl_prescription WHERE prescription_id = ?', [id]);
    await audit(req, 'delete', 'prescription', id);
    ok(res, { prescription_id: id }, 'Prescription deleted.');
  },

  verify: async (req, res) => {
    const { id } = req.valid.params;
    if (!req.user.pharmacist_id) throw forbidden('Only a licensed pharmacist account can verify prescriptions.');
    const rx = await loadEditable(req, id);
    if (rx.status !== 'pending') throw conflict(`This prescription is already ${rx.status.replace('_', ' ')}.`);
    await query(
      "UPDATE tbl_prescription SET status = 'verified', pharmacist_id = ?, reviewed_at = NOW(), rejection_reason = NULL WHERE prescription_id = ?",
      [req.user.pharmacist_id, id],
    );
    await audit(req, 'verify', 'prescription', id);
    ok(res, await Prescription.getById(id), 'Prescription verified. It can now be dispensed at the POS.');
  },

  reject: async (req, res) => {
    const { id } = req.valid.params;
    if (!req.user.pharmacist_id) throw forbidden('Only a licensed pharmacist account can reject prescriptions.');
    const rx = await loadEditable(req, id);
    if (rx.status !== 'pending') throw conflict(`This prescription is already ${rx.status.replace('_', ' ')}.`);
    await query(
      "UPDATE tbl_prescription SET status = 'rejected', pharmacist_id = ?, reviewed_at = NOW(), rejection_reason = ? WHERE prescription_id = ?",
      [req.user.pharmacist_id, req.valid.body.reason, id],
    );
    await audit(req, 'reject', 'prescription', id, { reason: req.valid.body.reason });
    ok(res, await Prescription.getById(id), 'Prescription rejected.');
  },
};

export default prescriptionController;
