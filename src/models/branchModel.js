import { query } from '../config/db.js';

const Branch = {
  list: (includeInactive) => query(
    `SELECT b.*, (SELECT COUNT(*) FROM tbl_users u WHERE u.branch_id = b.branch_id AND u.is_active = 1) AS staff_count
       FROM tbl_branches b ${includeInactive ? '' : 'WHERE b.is_active = 1'} ORDER BY b.name`,
  ),
  getById: async (id) => (await query('SELECT * FROM tbl_branches WHERE branch_id = ?', [id]))[0],
  create: async (b) => (await query('INSERT INTO tbl_branches (name, address, phone, is_active) VALUES (?, ?, ?, ?)', [b.name, b.address, b.phone ?? null, b.is_active ?? true])).insertId,
  update: (id, b) => query('UPDATE tbl_branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE branch_id = ?', [b.name, b.address, b.phone ?? null, b.is_active ?? true, id]),
  setActive: (id, active) => query('UPDATE tbl_branches SET is_active = ? WHERE branch_id = ?', [active, id]),
  activeStaff: async (id) => (await query('SELECT COUNT(*) AS n FROM tbl_users WHERE branch_id = ? AND is_active = 1', [id]))[0].n,
};

export default Branch;
