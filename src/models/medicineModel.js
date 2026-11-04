import { query } from '../config/db.js';
import { where, like, orderBy, SELLABLE } from '../utils/sql.js';
import { NEAR_EXPIRY_DAYS } from '../config/pricing.js';

// Stock is summed from batches for one branch (or all branches when branchId is null).
// Expired units are reported separately because they cannot be sold.
const stockJoin = `
  LEFT JOIN (
    SELECT b.medicine_id,
           SUM(IF(${SELLABLE}, b.qty_on_hand, 0)) AS sellable,
           SUM(IF(${SELLABLE}, 0, b.qty_on_hand)) AS expired_qty,
           SUM(IF(${SELLABLE} AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ${NEAR_EXPIRY_DAYS} DAY), b.qty_on_hand, 0)) AS expiring_qty,
           MIN(IF(${SELLABLE} AND b.qty_on_hand > 0, b.expiry_date, NULL)) AS nearest_expiry
      FROM tbl_batches b
     WHERE (? IS NULL OR b.branch_id = ?)
     GROUP BY b.medicine_id
  ) s ON s.medicine_id = m.medicine_id`;

const base = `
  SELECT m.*,
         COALESCE(s.sellable, 0) AS stock_on_hand,
         COALESCE(s.expired_qty, 0) AS expired_qty,
         COALESCE(s.expiring_qty, 0) AS expiring_qty,
         s.nearest_expiry,
         DATEDIFF(s.nearest_expiry, CURDATE()) AS days_to_expiry,
         CASE WHEN COALESCE(s.sellable, 0) = 0 THEN 'out'
              WHEN s.sellable <= m.reorder_level THEN 'low'
              ELSE 'in' END AS stock_status
    FROM tbl_medicines m
    ${stockJoin}`;

const SORT = { generic_name: 't.generic_name', brand: 't.brand', price: 't.price', stock_on_hand: 't.stock_on_hand', nearest_expiry: 't.nearest_expiry' };

const Medicine = {
  list: async ({ q, category, rx, stock, status, sort, dir, limit, offset }, branchId) => {
    const w = where()
      .if(q, '(t.generic_name LIKE ? OR t.brand LIKE ? OR t.barcode = ?)', q && like(q), q && like(q), q)
      .if(category, 't.category = ?', category)
      .if(rx, 't.requires_prescription = ?', rx === 'rx' ? 1 : 0)
      .if(['in', 'low', 'out'].includes(stock) ? stock : null, 't.stock_status = ?', stock)
      .if(stock === 'expiring' ? true : null, 't.expiring_qty > 0')
      .if(stock === 'expired' ? true : null, 't.expired_qty > 0')
      .if(status !== 'all' ? status : null, 't.is_active = ?', status === 'active' ? 1 : 0);
    const scope = [branchId ?? null, branchId ?? null];
    const rows = await query(
      `SELECT * FROM (${base}) t ${w.sql} ${orderBy(SORT, sort, dir, 't.generic_name')}, t.brand LIMIT ? OFFSET ?`,
      [...scope, ...w.params, limit, offset],
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM (${base}) t ${w.sql}`, [...scope, ...w.params]);
    return { rows, total };
  },

  getById: async (id, branchId = null) =>
    (await query(`${base} WHERE m.medicine_id = ?`, [branchId, branchId, id]))[0],

  findByBarcode: async (barcode, branchId) =>
    (await query(`${base} WHERE m.barcode = ? AND m.is_active = 1`, [branchId, branchId, barcode]))[0],

  /** Per-branch stock breakdown, so managers can see where to send stock from. */
  stockByBranch: (id) => query(
    `SELECT br.branch_id, br.name AS branch_name,
            COALESCE(SUM(IF(${SELLABLE}, b.qty_on_hand, 0)), 0) AS sellable,
            COALESCE(SUM(IF(${SELLABLE}, 0, b.qty_on_hand)), 0) AS expired_qty
       FROM tbl_branches br
       LEFT JOIN tbl_batches b ON b.branch_id = br.branch_id AND b.medicine_id = ?
      WHERE br.is_active = 1
      GROUP BY br.branch_id, br.name ORDER BY br.name`, [id],
  ),

  create: async (m) => (await query(
    `INSERT INTO tbl_medicines (generic_name, brand, category, dosage_form, strength, unit, price, requires_prescription, reorder_level, barcode, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.generic_name, m.brand, m.category, m.dosage_form, m.strength, m.unit, m.price, m.requires_prescription, m.reorder_level, m.barcode ?? null, m.is_active ?? true],
  )).insertId,

  update: (id, m) => query(
    `UPDATE tbl_medicines SET generic_name = ?, brand = ?, category = ?, dosage_form = ?, strength = ?, unit = ?, price = ?,
            requires_prescription = ?, reorder_level = ?, barcode = ?, is_active = ? WHERE medicine_id = ?`,
    [m.generic_name, m.brand, m.category, m.dosage_form, m.strength, m.unit, m.price, m.requires_prescription, m.reorder_level, m.barcode ?? null, m.is_active ?? true, id],
  ),

  setActive: (id, active) => query('UPDATE tbl_medicines SET is_active = ? WHERE medicine_id = ?', [active, id]),
};

export default Medicine;
