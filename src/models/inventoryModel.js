import { query } from '../config/db.js';
import { where, like, orderBy, SELLABLE } from '../utils/sql.js';
import { NEAR_EXPIRY_DAYS } from '../config/pricing.js';

const BATCH_SELECT = `
  SELECT b.*, m.generic_name, m.brand, m.strength, m.dosage_form, m.unit, br.name AS branch_name, b.supplier AS supplier_name,
         DATEDIFF(b.expiry_date, CURDATE()) AS days_to_expiry,
         CASE WHEN NOT (${SELLABLE}) THEN 'expired'
              WHEN b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${NEAR_EXPIRY_DAYS} DAY) THEN 'near'
              ELSE 'ok' END AS expiry_status
    FROM tbl_batches b
    JOIN tbl_medicines m ON m.medicine_id = b.medicine_id
    JOIN tbl_branches br ON br.branch_id = b.branch_id`;

const Inventory = {
  listBatches: async ({ q, medicine, expiry, in_stock, sort, dir, limit, offset }, branchId) => {
    const w = where()
      .if(branchId, 'b.branch_id = ?', branchId)
      .if(medicine, 'b.medicine_id = ?', medicine)
      .if(q, '(m.generic_name LIKE ? OR m.brand LIKE ? OR b.batch_no LIKE ?)', ...(q ? Array(3).fill(like(q)) : []))
      .if(in_stock === true ? true : null, 'b.qty_on_hand > 0');
    if (expiry === 'expired') w.add(`NOT (${SELLABLE})`);
    if (expiry === 'near') w.add(`${SELLABLE} AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${NEAR_EXPIRY_DAYS} DAY)`);
    if (expiry === 'ok') w.add(`b.expiry_date > DATE_ADD(CURDATE(), INTERVAL ${NEAR_EXPIRY_DAYS} DAY)`);
    const sortCols = { expiry_date: 'b.expiry_date', qty_on_hand: 'b.qty_on_hand', received_at: 'b.received_at', generic_name: 'm.generic_name' };
    const rows = await query(`${BATCH_SELECT} ${w.sql} ${orderBy(sortCols, sort, dir, 'b.expiry_date')}, b.batch_id LIMIT ? OFFSET ?`, [...w.params, limit, offset]);
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM tbl_batches b JOIN tbl_medicines m ON m.medicine_id = b.medicine_id ${w.sql}`, w.params,
    );
    return { rows, total };
  },

  getBatch: async (id) => (await query(`${BATCH_SELECT} WHERE b.batch_id = ?`, [id]))[0],

  updateBatch: (id, b) => query(
    'UPDATE tbl_batches SET batch_no = ?, expiry_date = ?, cost_price = ?, supplier = ? WHERE batch_id = ?',
    [b.batch_no, b.expiry_date, b.cost_price, b.supplier ?? null, id],
  ),

  alerts: async (branchId) => {
    const scope = [branchId ?? null, branchId ?? null];
    // Evaluated per branch: plenty of stock at one branch does not hide a shortage at another.
    const lowStock = await query(
      `SELECT m.medicine_id, m.generic_name, m.brand, m.strength, m.reorder_level, br.branch_id, br.name AS branch_name,
              COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand, 0)), 0) AS stock_on_hand
         FROM tbl_medicines m
         CROSS JOIN tbl_branches br
         LEFT JOIN tbl_batches b ON b.medicine_id = m.medicine_id AND b.branch_id = br.branch_id
        WHERE m.is_active = 1 AND br.is_active = 1 AND (? IS NULL OR br.branch_id = ?)
        GROUP BY br.branch_id, br.name, m.medicine_id
       HAVING stock_on_hand <= m.reorder_level
        ORDER BY stock_on_hand, m.generic_name`, scope,
    );
    const batchAlerts = (condition) => query(
      `${BATCH_SELECT} WHERE b.qty_on_hand > 0 AND (? IS NULL OR b.branch_id = ?) AND ${condition} ORDER BY b.expiry_date LIMIT 100`, scope,
    );
    const nearExpiry = await batchAlerts(`${SELLABLE} AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${NEAR_EXPIRY_DAYS} DAY)`);
    const expired = await batchAlerts(`NOT (${SELLABLE})`);
    return { near_expiry_days: NEAR_EXPIRY_DAYS, low_stock: lowStock, near_expiry: nearExpiry, expired };
  },

  /** Suggests enough stock for 30 days of recent sales, or twice the reorder level, whichever is larger. */
  reorder: (branchId) => query(
    `SELECT t.*, GREATEST(t.reorder_level * 2, t.sold_30d) - t.stock_on_hand AS suggested_qty
       FROM (
         SELECT m.medicine_id, m.generic_name, m.brand, m.strength, m.reorder_level,
                COALESCE((SELECT SUM(IF(${SELLABLE}, b.qty_on_hand, 0)) FROM tbl_batches b
                           WHERE b.medicine_id = m.medicine_id AND (? IS NULL OR b.branch_id = ?)), 0) AS stock_on_hand,
                COALESCE((SELECT SUM(si.quantity) FROM tbl_sale_items si JOIN tbl_sales s ON s.sale_id = si.sale_id
                           WHERE si.medicine_id = m.medicine_id AND s.status = 'completed'
                             AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND (? IS NULL OR s.branch_id = ?)), 0) AS sold_30d,
                (SELECT b.supplier FROM tbl_batches b
                  WHERE b.medicine_id = m.medicine_id AND b.supplier IS NOT NULL ORDER BY b.received_at DESC LIMIT 1) AS last_supplier
           FROM tbl_medicines m WHERE m.is_active = 1
       ) t
      WHERE t.stock_on_hand <= t.reorder_level
      ORDER BY t.stock_on_hand, t.generic_name`,
    [branchId ?? null, branchId ?? null, branchId ?? null, branchId ?? null],
  ),

  movements: async ({ medicine, batch, type, from, to, limit, offset }, branchId) => {
    const w = where()
      .if(branchId, 'b.branch_id = ?', branchId)
      .if(batch, 'mv.batch_id = ?', batch)
      .if(medicine, 'b.medicine_id = ?', medicine)
      .if(type, 'mv.type = ?', type)
      .if(from, 'mv.created_at >= ?', from)
      .if(to, 'mv.created_at < DATE_ADD(?, INTERVAL 1 DAY)', to);
    const from_ = `FROM tbl_stock_movements mv
      JOIN tbl_batches b ON b.batch_id = mv.batch_id
      JOIN tbl_medicines m ON m.medicine_id = b.medicine_id
      JOIN tbl_users u ON u.user_id = mv.user_id
      JOIN tbl_branches br ON br.branch_id = b.branch_id`;
    const rows = await query(
      `SELECT mv.*, b.batch_no, m.generic_name, m.brand, m.strength, u.full_name AS user_name, br.name AS branch_name
       ${from_} ${w.sql} ORDER BY mv.created_at DESC, mv.movement_id DESC LIMIT ? OFFSET ?`,
      [...w.params, limit, offset],
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total ${from_} ${w.sql}`, w.params);
    return { rows, total };
  },
};

export default Inventory;
