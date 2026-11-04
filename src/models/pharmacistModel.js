import { query } from '../config/db.js';
import { where, like } from '../utils/sql.js';

const SELECT = `SELECT p.*, u.username, u.branch_id, b.name AS branch_name,
                       DATEDIFF(p.license_expiry, CURDATE()) AS license_days_left
                  FROM tbl_pharmacists p
                  LEFT JOIN tbl_users u ON u.user_id = p.user_id
                  LEFT JOIN tbl_branches b ON b.branch_id = u.branch_id`;

const Pharmacist = {
  list: ({ q, status }) => {
    const w = where()
      .if(q, '(p.firstname LIKE ? OR p.lastname LIKE ? OR p.license_no LIKE ? OR p.email LIKE ?)', ...(q ? Array(4).fill(like(q)) : []))
      .if(status !== 'all' ? status : null, 'p.is_active = ?', status === 'active' ? 1 : 0);
    return query(`${SELECT} ${w.sql} ORDER BY p.lastname, p.firstname`, w.params);
  },
  getById: async (id) => (await query(`${SELECT} WHERE p.pharmacist_id = ?`, [id]))[0],
  create: async (p) => (await query(
    'INSERT INTO tbl_pharmacists (firstname, lastname, email, phone, license_no, license_expiry, user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [p.firstname, p.lastname, p.email ?? null, p.phone ?? null, p.license_no, p.license_expiry, p.user_id ?? null, p.is_active ?? true],
  )).insertId,
  update: (id, p) => query(
    'UPDATE tbl_pharmacists SET firstname = ?, lastname = ?, email = ?, phone = ?, license_no = ?, license_expiry = ?, user_id = ?, is_active = ? WHERE pharmacist_id = ?',
    [p.firstname, p.lastname, p.email ?? null, p.phone ?? null, p.license_no, p.license_expiry, p.user_id ?? null, p.is_active ?? true, id],
  ),
  setActive: (id, active) => query('UPDATE tbl_pharmacists SET is_active = ? WHERE pharmacist_id = ?', [active, id]),
  userRole: async (userId) => (await query('SELECT role FROM tbl_users WHERE user_id = ?', [userId]))[0]?.role,
};

export default Pharmacist;
