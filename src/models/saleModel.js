import { query } from '../config/db.js';
import { where, like, orderBy } from '../utils/sql.js';

const FROM = `
  FROM tbl_sales s
  JOIN tbl_branches br ON br.branch_id = s.branch_id
  JOIN tbl_users u ON u.user_id = s.cashier_id
  LEFT JOIN tbl_customers c ON c.customer_id = s.customer_id
  LEFT JOIN tbl_users v ON v.user_id = s.voided_by`;

const COLUMNS = `s.*, s.amount_tendered - s.total AS change_due, br.name AS branch_name, br.address AS branch_address, br.phone AS branch_phone, u.full_name AS cashier_name,
  CONCAT(c.firstname, ' ', c.lastname) AS customer_name, v.full_name AS voided_by_name,
  (SELECT SUM(si.quantity) FROM tbl_sale_items si WHERE si.sale_id = s.sale_id) AS item_count`;

const Sale = {
  list: async ({ q, status, payment, customer, cashier, from, to, sort, dir, limit, offset }, branchId) => {
    const w = where()
      .if(branchId, 's.branch_id = ?', branchId)
      .if(status, 's.status = ?', status)
      .if(payment, 's.payment_method = ?', payment)
      .if(customer, 's.customer_id = ?', customer)
      .if(cashier, 's.cashier_id = ?', cashier)
      .if(from, 's.created_at >= ?', from)
      .if(to, 's.created_at < DATE_ADD(?, INTERVAL 1 DAY)', to)
      .if(q, "(s.receipt_no LIKE ? OR CONCAT(c.firstname, ' ', c.lastname) LIKE ? OR s.payment_ref LIKE ?)", ...(q ? Array(3).fill(like(q)) : []));
    const rows = await query(
      `SELECT ${COLUMNS} ${FROM} ${w.sql} ${orderBy({ created_at: 's.created_at', total: 's.total', receipt_no: 's.receipt_no' }, sort, sort ? dir : 'desc', 's.created_at')}
       LIMIT ? OFFSET ?`, [...w.params, limit, offset],
    );
    const [summary] = await query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(IF(s.status = 'completed', s.total, 0)), 0) AS revenue ${FROM} ${w.sql}`, w.params,
    );
    return { rows, total: summary.total, revenue: summary.revenue };
  },

  getById: async (id) => {
    const [sale] = await query(`SELECT ${COLUMNS}, p.doctor_name ${FROM} LEFT JOIN tbl_prescription p ON p.prescription_id = s.prescription_id WHERE s.sale_id = ?`, [id]);
    if (!sale) return null;
    sale.items = await query(
      `SELECT si.medicine_id, m.generic_name, m.brand, m.strength, m.dosage_form, m.requires_prescription, si.unit_price,
              SUM(si.quantity) AS quantity, SUM(si.line_total) AS line_total,
              GROUP_CONCAT(CONCAT(b.batch_no, ' (exp ', DATE_FORMAT(b.expiry_date, '%Y-%m-%d'), ')') ORDER BY b.expiry_date SEPARATOR ', ') AS batches
         FROM tbl_sale_items si
         JOIN tbl_medicines m ON m.medicine_id = si.medicine_id
         JOIN tbl_batches b ON b.batch_id = si.batch_id
        WHERE si.sale_id = ?
        GROUP BY si.medicine_id, si.unit_price, m.generic_name, m.brand, m.strength, m.dosage_form, m.requires_prescription
        ORDER BY MIN(si.sale_item_id)`, [id],
    );
    return sale;
  },
};

export default Sale;
