import { query } from '../config/db.js';
import { SELLABLE } from '../utils/sql.js';
import { NEAR_EXPIRY_DAYS } from '../config/pricing.js';

const scope = (column, branchId) => (branchId ? { sql: `AND ${column} = ?`, params: [branchId] } : { sql: '', params: [] });
const range = (column, from, to) => ({
  sql: `AND ${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`,
  params: [from, to],
});

export async function dashboard(branchId, role) {
  const sb = scope('s.branch_id', branchId);
  const bb = scope('b.branch_id', branchId);
  const pb = scope('p.branch_id', branchId);

  const [today] = await query(
    `SELECT COUNT(*) AS transactions, COALESCE(SUM(s.total), 0) AS revenue,
            COALESCE(SUM(s.discount_amount), 0) AS discounts,
            COALESCE(SUM(IF(s.payment_method = 'cash', s.total, 0)), 0) AS cash,
            COALESCE(SUM(IF(s.payment_method = 'gcash', s.total, 0)), 0) AS gcash,
            COALESCE(SUM(IF(s.payment_method = 'card', s.total, 0)), 0) AS card
       FROM tbl_sales s WHERE s.status = 'completed' AND s.created_at >= CURDATE() ${sb.sql}`, sb.params,
  );
  const [yesterday] = await query(
    `SELECT COALESCE(SUM(s.total), 0) AS revenue, COUNT(*) AS transactions FROM tbl_sales s
      WHERE s.status = 'completed' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND s.created_at < CURDATE() ${sb.sql}`, sb.params,
  );
  const daily = await query(
    `SELECT DATE(s.created_at) AS day, COUNT(*) AS transactions, SUM(s.total) AS revenue
       FROM tbl_sales s WHERE s.status = 'completed' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY) ${sb.sql}
      GROUP BY DATE(s.created_at) ORDER BY day`, sb.params,
  );
  const topMedicines = await query(
    `SELECT m.medicine_id, m.generic_name, m.brand, m.strength, SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue
       FROM tbl_sale_items si JOIN tbl_sales s ON s.sale_id = si.sale_id JOIN tbl_medicines m ON m.medicine_id = si.medicine_id
      WHERE s.status = 'completed' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) ${sb.sql}
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
       (SELECT COUNT(*) FROM tbl_batches b WHERE b.qty_on_hand > 0 AND NOT (${SELLABLE}) ${bb.sql}) AS expired,
       (SELECT COALESCE(SUM(b.qty_on_hand * b.cost_price), 0) FROM tbl_batches b WHERE ${SELLABLE} ${bb.sql}) AS stock_value,
       (SELECT COUNT(*) FROM tbl_medicines WHERE is_active = 1) AS active_medicines`,
    [...(branchId ? [branchId] : []), ...bb.params, ...bb.params, ...bb.params],
  );
  const [rx] = await query(
    `SELECT SUM(p.status = 'pending') AS pending, SUM(p.status IN ('verified', 'partially_dispensed')) AS ready
       FROM tbl_prescription p WHERE 1 = 1 ${pb.sql}`, pb.params,
  );
  const [transfers] = await query(
    `SELECT SUM(t.status = 'requested' ${branchId ? 'AND t.from_branch_id = ?' : ''}) AS to_dispatch,
            SUM(t.status = 'in_transit' ${branchId ? 'AND t.to_branch_id = ?' : ''}) AS to_receive
       FROM tbl_transfers t`, branchId ? [branchId, branchId] : [],
  );
  const recentSales = await query(
    `SELECT s.sale_id, s.receipt_no, s.total, s.status, s.payment_method, s.created_at, CONCAT(c.firstname, ' ', c.lastname) AS customer_name
       FROM tbl_sales s LEFT JOIN tbl_customers c ON c.customer_id = s.customer_id WHERE 1 = 1 ${sb.sql}
      ORDER BY s.created_at DESC LIMIT 6`, sb.params,
  );

  const result = {
    today, yesterday, daily: fillDays(daily, 14), top_medicines: topMedicines, stock,
    prescriptions: { pending: Number(rx.pending ?? 0), ready: Number(rx.ready ?? 0) },
    transfers: { to_dispatch: Number(transfers.to_dispatch ?? 0), to_receive: Number(transfers.to_receive ?? 0) },
    recent_sales: recentSales, near_expiry_days: NEAR_EXPIRY_DAYS,
  };

  if (role === 'admin' || role === 'manager') {
    result.license_alerts = await query(
      `SELECT pharmacist_id, CONCAT(firstname, ' ', lastname) AS name, license_no, license_expiry,
              DATEDIFF(license_expiry, CURDATE()) AS days_left
         FROM tbl_pharmacists WHERE is_active = 1 AND license_expiry <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
        ORDER BY license_expiry`,
    );
  }
  if (role === 'admin' && !branchId) {
    result.branches = await query(
      `SELECT br.branch_id, br.name,
              COALESCE(SUM(IF(s.created_at >= CURDATE(), s.total, 0)), 0) AS today_revenue,
              COALESCE(SUM(IF(s.created_at >= CURDATE(), 1, 0)), 0) AS today_transactions,
              COALESCE(SUM(s.total), 0) AS revenue_30d
         FROM tbl_branches br
         LEFT JOIN tbl_sales s ON s.branch_id = br.branch_id AND s.status = 'completed' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
        WHERE br.is_active = 1 GROUP BY br.branch_id, br.name ORDER BY br.name`,
    );
  }
  return result;
}

// Days without sales still appear in the chart as zero instead of silently disappearing.
function fillDays(rows, days) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const result = [];
  const today = new Date(Date.now() + 8 * 3600 * 1000);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    const row = byDay.get(day);
    result.push({ day, transactions: Number(row?.transactions ?? 0), revenue: Number(row?.revenue ?? 0) });
  }
  return result;
}

export const reports = {
  'daily-sales': {
    title: 'Daily sales',
    columns: [['day', 'Date'], ['transactions', 'Transactions'], ['voided', 'Voided'], ['gross', 'Gross sales'], ['discounts', 'Discounts'], ['vat', 'VAT'], ['net', 'Net sales']],
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
    title: 'Sales by medicine',
    columns: [['generic_name', 'Generic name'], ['brand', 'Brand'], ['strength', 'Strength'], ['category', 'Category'], ['quantity', 'Units sold'], ['revenue', 'Revenue before discounts'], ['gross_profit', 'Gross profit']],
    run: ({ branchId, from, to }) => {
      const sb = scope('s.branch_id', branchId);
      const r = range('s.created_at', from, to);
      return query(
        `SELECT m.generic_name, m.brand, m.strength, c.name AS category, SUM(si.quantity) AS quantity, SUM(si.line_total) AS revenue,
                SUM(si.line_total - si.quantity * b.cost_price) AS gross_profit
           FROM tbl_sale_items si
           JOIN tbl_sales s ON s.sale_id = si.sale_id
           JOIN tbl_medicines m ON m.medicine_id = si.medicine_id
           JOIN tbl_categories c ON c.category_id = m.category_id
           JOIN tbl_batches b ON b.batch_id = si.batch_id
          WHERE s.status = 'completed' ${r.sql} ${sb.sql}
          GROUP BY m.medicine_id ORDER BY revenue DESC`, [...r.params, ...sb.params],
      );
    },
  },
  'stock-status': {
    title: 'Stock status',
    columns: [['generic_name', 'Generic name'], ['brand', 'Brand'], ['strength', 'Strength'], ['category', 'Category'], ['stock_on_hand', 'Sellable units'], ['expired_qty', 'Expired units'], ['reorder_level', 'Reorder level'], ['stock_status', 'Status'], ['stock_value', 'Value at cost'], ['nearest_expiry', 'Nearest expiry']],
    run: ({ branchId }) => query(
      `SELECT m.generic_name, m.brand, m.strength, c.name AS category,
              COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand, 0)), 0) AS stock_on_hand,
              COALESCE(SUM(IF(${SELLABLE}, 0, b.qty_on_hand)), 0) AS expired_qty,
              m.reorder_level,
              CASE WHEN COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand, 0)), 0) = 0 THEN 'Out of stock'
                   WHEN SUM(IF(${SELLABLE}, b.qty_on_hand, 0)) <= m.reorder_level THEN 'Low' ELSE 'OK' END AS stock_status,
              COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand * b.cost_price, 0)), 0) AS stock_value,
              MIN(IF(${SELLABLE} AND b.qty_on_hand > 0, b.expiry_date, NULL)) AS nearest_expiry
         FROM tbl_medicines m
         JOIN tbl_categories c ON c.category_id = m.category_id
         LEFT JOIN tbl_batches b ON b.medicine_id = m.medicine_id ${branchId ? 'AND b.branch_id = ?' : ''}
        WHERE m.is_active = 1
        GROUP BY m.medicine_id ORDER BY m.generic_name, m.brand`, branchId ? [branchId] : [],
    ),
  },
  expiring: {
    title: 'Expiring and expired stock',
    columns: [['generic_name', 'Generic name'], ['brand', 'Brand'], ['strength', 'Strength'], ['batch_no', 'Batch'], ['branch', 'Branch'], ['expiry_date', 'Expiry date'], ['days_left', 'Days left'], ['qty_on_hand', 'Units'], ['value_at_cost', 'Value at cost']],
    run: ({ branchId, days }) => query(
      `SELECT m.generic_name, m.brand, m.strength, b.batch_no, br.name AS branch, b.expiry_date,
              DATEDIFF(b.expiry_date, CURDATE()) AS days_left, b.qty_on_hand, b.qty_on_hand * b.cost_price AS value_at_cost
         FROM tbl_batches b
         JOIN tbl_medicines m ON m.medicine_id = b.medicine_id
         JOIN tbl_branches br ON br.branch_id = b.branch_id
        WHERE b.qty_on_hand > 0 AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) ${branchId ? 'AND b.branch_id = ?' : ''}
        ORDER BY b.expiry_date`, branchId ? [days, branchId] : [days],
    ),
  },
  'branch-summary': {
    title: 'Branch summary',
    columns: [['branch', 'Branch'], ['transactions', 'Transactions'], ['revenue', 'Net sales'], ['average_sale', 'Average sale'], ['discounts', 'Discounts given'], ['voided', 'Voided sales'], ['stock_value', 'Stock value at cost'], ['expired_value', 'Expired stock at cost']],
    run: ({ branchId, from, to }) => query(
      `SELECT br.name AS branch,
              COALESCE(s.transactions, 0) AS transactions, COALESCE(s.revenue, 0) AS revenue,
              COALESCE(ROUND(s.revenue / NULLIF(s.transactions, 0), 2), 0) AS average_sale,
              COALESCE(s.discounts, 0) AS discounts, COALESCE(s.voided, 0) AS voided,
              COALESCE(st.stock_value, 0) AS stock_value, COALESCE(st.expired_value, 0) AS expired_value
         FROM tbl_branches br
         LEFT JOIN (
           SELECT branch_id, SUM(status = 'completed') AS transactions, SUM(IF(status = 'completed', total, 0)) AS revenue,
                  SUM(IF(status = 'completed', discount_amount, 0)) AS discounts, SUM(status = 'voided') AS voided
             FROM tbl_sales WHERE created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY) GROUP BY branch_id
         ) s ON s.branch_id = br.branch_id
         LEFT JOIN (
           SELECT b.branch_id, SUM(IF(${SELLABLE}, b.qty_on_hand * b.cost_price, 0)) AS stock_value,
                  SUM(IF(${SELLABLE}, 0, b.qty_on_hand * b.cost_price)) AS expired_value
             FROM tbl_batches b GROUP BY b.branch_id
         ) st ON st.branch_id = br.branch_id
        WHERE br.is_active = 1 ${branchId ? 'AND br.branch_id = ?' : ''}
        ORDER BY br.name`, branchId ? [from, to, branchId] : [from, to],
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
