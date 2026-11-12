import { query } from '../config/db.js';
import { where, like, orderBy, SELLABLE } from '../utils/sql.js';
import { RX_VALID_DAYS } from '../config/pricing.js';

const SELECT = `
  SELECT p.*, CONCAT(c.firstname, ' ', c.lastname) AS customer_name, c.phone AS customer_phone,
         c.discount_id_type AS customer_discount_type,
         rv.full_name AS pharmacist_name, rv.license_no AS pharmacist_license_no,
         br.name AS branch_name, br.address AS branch_address, br.phone AS branch_phone, u.full_name AS created_by_name,
         (SELECT COUNT(*) FROM tbl_prescribed_items i WHERE i.prescription_id = p.prescription_id) AS item_count,
         DATEDIFF(CURDATE(), p.date_issued) AS days_since_issued,
         DATEDIFF(CURDATE(), p.date_issued) > ${RX_VALID_DAYS} AS is_expired
    FROM tbl_prescription p
    JOIN tbl_customers c ON c.customer_id = p.customer_id
    JOIN tbl_branches br ON br.branch_id = p.branch_id
    JOIN tbl_users u ON u.user_id = p.created_by
    LEFT JOIN tbl_users rv ON rv.user_id = p.reviewed_by`;

const Prescription = {
  list: async ({ q, status, customer, sort, dir, limit, offset }, branchId) => {
    const w = where()
      .if(branchId, 'p.branch_id = ?', branchId)
      .if(customer, 'p.customer_id = ?', customer)
      .if(q, "(CONCAT(c.firstname, ' ', c.lastname) LIKE ? OR p.doctor_name LIKE ? OR p.prescription_id = ?)", q && like(q), q && like(q), q && Number(q.replace(/\D/g, '')) || 0);
    // Ready to give out: checked by a pharmacist and still within its validity period.
    if (status === 'dispensable') w.add(`p.status IN ('verified', 'partially_dispensed') AND p.date_issued >= DATE_SUB(CURDATE(), INTERVAL ${RX_VALID_DAYS} DAY)`);
    else w.if(status, 'p.status = ?', status);
    const rows = await query(
      `${SELECT} ${w.sql} ${orderBy({ created_at: 'p.created_at', date_issued: 'p.date_issued', status: 'p.status' }, sort, sort ? dir : 'desc', 'p.created_at')} LIMIT ? OFFSET ?`,
      [...w.params, limit, offset],
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM tbl_prescription p JOIN tbl_customers c ON c.customer_id = p.customer_id ${w.sql}`, w.params);
    return { rows, total };
  },

  getById: async (id) => {
    const [rx] = await query(`${SELECT} WHERE p.prescription_id = ?`, [id]);
    if (!rx) return null;
    rx.items = await query(
      `SELECT i.*, i.quantity - i.qty_dispensed AS remaining, m.generic_name, m.brand, m.strength, m.dosage_form, m.unit,
              m.price, m.requires_prescription,
              COALESCE((SELECT SUM(b.qty_on_hand) FROM tbl_batches b
                         WHERE b.medicine_id = i.medicine_id AND b.branch_id = ? AND ${SELLABLE}), 0) AS stock_on_hand
         FROM tbl_prescribed_items i JOIN tbl_medicines m ON m.medicine_id = i.medicine_id
        WHERE i.prescription_id = ? ORDER BY i.item_id`,
      [rx.branch_id, id],
    );
    // The sales that dispensed this prescription, so the printed record shows what was given and when.
    rx.sales = await query(
      `SELECT s.sale_id, s.receipt_no, s.total, s.status, s.created_at, u.full_name AS cashier_name
         FROM tbl_sales s JOIN tbl_users u ON u.user_id = s.cashier_id
        WHERE s.prescription_id = ? ORDER BY s.created_at`, [id],
    );
    return rx;
  },

  insertItems: (conn, prescriptionId, items) => conn.query(
    'INSERT INTO tbl_prescribed_items (prescription_id, medicine_id, quantity, instructions) VALUES ?',
    [items.map((i) => [prescriptionId, i.medicine_id, i.quantity, i.instructions ?? null])],
  ),
};

export default Prescription;
