import { query } from '../config/db.js';
import { SELLABLE } from '../utils/sql.js';
import { NEAR_EXPIRY_DAYS } from '../config/pricing.js';
import User from '../models/userModel.js';

const scope = (column, branchId) => (branchId ? { sql: `AND ${column} = ?`, params: [branchId] } : { sql: '', params: [] });
const range = (column, from, to) => ({
  sql: `AND ${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`,
  params: [from, to],
});

/** Home page numbers: today's sales, what needs attention, and prescriptions waiting. */
export async function dashboard(branchId, { owner, manager }) {
  const sb = scope('s.branch_id', branchId);
  const bb = scope('b.branch_id', branchId);
  const pb = scope('p.branch_id', branchId);

  const [today] = await query(
    `SELECT COUNT(*) AS transactions, COALESCE(SUM(s.total), 0) AS revenue,
            COALESCE(SUM(IF(s.payment_method = 'cash', s.total, 0)), 0) AS cash,
            COALESCE(SUM(IF(s.payment_method = 'gcash', s.total, 0)), 0) AS gcash,
            COALESCE(SUM(IF(s.payment_method = 'card', s.total, 0)), 0) AS card
       FROM tbl_sales s WHERE s.status = 'completed' AND s.created_at >= CURDATE() ${sb.sql}`, sb.params,
  );
  const [yesterday] = await query(
    `SELECT COALESCE(SUM(s.total), 0) AS revenue, COUNT(*) AS transactions FROM tbl_sales s
      WHERE s.status = 'completed' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND s.created_at < CURDATE() ${sb.sql}`, sb.params,
  );
  const topMedicines = await query(
    `SELECT m.medicine_id, m.generic_name, m.brand, m.strength, SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
       FROM tbl_sale_items si JOIN tbl_sales s ON s.sale_id = si.sale_id JOIN tbl_medicines m ON m.medicine_id = si.medicine_id
      WHERE s.status = 'completed' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) ${sb.sql}
      GROUP BY m.medicine_id ORDER BY quantity DESC LIMIT 5`, sb.params,
  );
  const [stock] = await query(
    `SELECT
       (SELECT COUNT(*) FROM (
          SELECT br.branch_id, m.medicine_id FROM tbl_medicines m
          CROSS JOIN tbl_branches br
          LEFT JOIN tbl_batches b ON b.medicine_id = m.medicine_id AND b.branch_id = br.branch_id
          WHERE m.is_active = 1 AND br.is_active = 1 ${branchId ? 'AND br.branch_id = ?' : ''}
          GROUP BY br.branch_id, m.medicine_id, m.reorder_level
          HAVING COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand, 0)), 0) <= m.reorder_level) x) AS low_stock,
       (SELECT COUNT(*) FROM tbl_batches b WHERE b.qty_on_hand > 0 AND ${SELLABLE}
           AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${NEAR_EXPIRY_DAYS} DAY) ${bb.sql}) AS near_expiry,
       (SELECT COUNT(*) FROM tbl_batches b WHERE b.qty_on_hand > 0 AND NOT (${SELLABLE}) ${bb.sql}) AS expired`,
    [...(branchId ? [branchId] : []), ...bb.params, ...bb.params],
  );
  const [rx] = await query(
    `SELECT SUM(p.status = 'pending') AS pending, SUM(p.status IN ('verified', 'partially_dispensed')) AS ready
       FROM tbl_prescription p WHERE 1 = 1 ${pb.sql}`, pb.params,
  );
  const recentSales = await query(
    `SELECT s.sale_id, s.receipt_no, s.total, s.status, s.payment_method, s.created_at, CONCAT(c.firstname, ' ', c.lastname) AS customer_name
       FROM tbl_sales s LEFT JOIN tbl_customers c ON c.customer_id = s.customer_id WHERE 1 = 1 ${sb.sql}
      ORDER BY s.created_at DESC LIMIT 5`, sb.params,
  );

  const result = {
    today, yesterday, top_medicines: topMedicines, stock,
    prescriptions: { pending: Number(rx.pending ?? 0), ready: Number(rx.ready ?? 0) },
    recent_sales: recentSales, near_expiry_days: NEAR_EXPIRY_DAYS,
  };

  if (manager) result.license_alerts = await User.licenseAlerts(60, branchId);
  if (owner && !branchId) {
    result.branches = await query(
      `SELECT br.branch_id, br.name,
              COALESCE(SUM(s.total), 0) AS today_revenue, COUNT(s.sale_id) AS today_transactions
         FROM tbl_branches br
         LEFT JOIN tbl_sales s ON s.branch_id = br.branch_id AND s.status = 'completed' AND s.created_at >= CURDATE()
        WHERE br.is_active = 1 GROUP BY br.branch_id, br.name ORDER BY br.name`,
    );
  }
  return result;
}

export const reports = {
  'daily-sales': {
    title: 'Sales summary',
    description: 'Sales per day: how many sales, discounts given, VAT, and the total collected.',
    columns: [['day', 'Date'], ['transactions', 'Sales'], ['voided', 'Voided'], ['gross', 'Before discounts'], ['discounts', 'Discounts'], ['vat', 'VAT'], ['net', 'Total collected']],
    run: ({ branchId, from, to }) => {
      const sb = scope('s.branch_id', branchId);
      const r = range('s.created_at', from, to);
      return query(
        `SELECT DATE(s.created_at) AS day,
                SUM(s.status = 'completed') AS transactions, SUM(s.status = 'voided') AS voided,
                SUM(IF(s.status = 'completed', s.subtotal, 0)) AS gross,
                SUM(IF(s.status = 'completed', s.discount_amount, 0)) AS discounts,
                SUM(IF(s.status = 'completed', s.vat_amount, 0)) AS vat,
                SUM(IF(s.status = 'completed', s.total, 0)) AS net
           FROM tbl_sales s WHERE 1 = 1 ${r.sql} ${sb.sql}
          GROUP BY DATE(s.created_at) ORDER BY day DESC`, [...r.params, ...sb.params],
      );
    },
  },
  'sales-by-medicine': {
    title: 'Best-selling medicines',
    description: 'Which medicines sold the most, and how much they earned.',
    columns: [['generic_name', 'Medicine'], ['brand', 'Brand'], ['strength', 'Strength'], ['quantity', 'Units sold'], ['revenue', 'Sales'], ['gross_profit', 'Profit']],
    run: ({ branchId, from, to }) => {
      const sb = scope('s.branch_id', branchId);
      const r = range('s.created_at', from, to);
      return query(
        `SELECT m.generic_name, m.brand, m.strength, m.category, SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue,
                SUM(si.line_total - si.quantity * b.cost_price) AS gross_profit
           FROM tbl_sale_items si
           JOIN tbl_sales s ON s.sale_id = si.sale_id
           JOIN tbl_medicines m ON m.medicine_id = si.medicine_id
           JOIN tbl_batches b ON b.batch_id = si.batch_id
          WHERE s.status = 'completed' ${r.sql} ${sb.sql}
          GROUP BY m.medicine_id ORDER BY quantity DESC, revenue DESC`, [...r.params, ...sb.params],
      );
    },
  },
  'stock-status': {
    title: 'Stock and expiry',
    description: 'How much of each medicine is in stock, what expires soon, and what has expired.',
    columns: [['generic_name', 'Medicine'], ['brand', 'Brand'], ['strength', 'Strength'], ['stock_on_hand', 'In stock'], ['stock_status', 'Status'], ['nearest_expiry', 'Next expiry'], ['expiring_qty', `Expiring in ${NEAR_EXPIRY_DAYS} days`], ['expired_qty', 'Expired'], ['stock_value', 'Value at cost']],
    run: ({ branchId }) => query(
      `SELECT m.generic_name, m.brand, m.strength, m.category,
              COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand, 0)), 0) AS stock_on_hand,
              COALESCE(SUM(IF(${SELLABLE}, 0, b.qty_on_hand)), 0) AS expired_qty,
              COALESCE(SUM(IF(${SELLABLE} AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${NEAR_EXPIRY_DAYS} DAY), b.qty_on_hand, 0)), 0) AS expiring_qty,
              m.reorder_level,
              CASE WHEN COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand, 0)), 0) = 0 THEN 'Out of stock'
                   WHEN SUM(IF(${SELLABLE}, b.qty_on_hand, 0)) <= m.reorder_level THEN 'Low' ELSE 'OK' END AS stock_status,
              COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand * b.cost_price, 0)), 0) AS stock_value,
              MIN(IF(${SELLABLE} AND b.qty_on_hand > 0, b.expiry_date, NULL)) AS nearest_expiry
         FROM tbl_medicines m
         LEFT JOIN tbl_batches b ON b.medicine_id = m.medicine_id ${branchId ? 'AND b.branch_id = ?' : ''}
        WHERE m.is_active = 1
        GROUP BY m.medicine_id ORDER BY m.generic_name, m.brand`, branchId ? [branchId] : [],
    ),
  },
};

export function toCsv(columns, rows) {
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Leading = + - @ would be run as a formula by spreadsheet apps.
    const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [columns.map(([, label]) => label).join(','), ...rows.map((r) => columns.map(([key]) => escape(r[key])).join(','))].join('\n');
}
