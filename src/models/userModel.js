import { query } from '../config/db.js';
import { where, like, orderBy } from '../utils/sql.js';

const SELECT = `SELECT u.user_id, u.username, u.full_name, u.role, u.branch_id, b.name AS branch_name,
                       u.license_no, u.license_expiry, DATEDIFF(u.license_expiry, CURDATE()) AS license_days_left,
                       u.is_active, u.last_login_at, u.created_at
                  FROM tbl_users u LEFT JOIN tbl_branches b ON b.branch_id = u.branch_id`;

// Only pharmacists carry a license; only managers may have no branch (the owner).
const values = (u) => {
  const pharmacist = u.role === 'pharmacist';
  return [u.username, u.full_name, u.role, u.branch_id ?? null,
    pharmacist ? u.license_no : null, pharmacist ? u.license_expiry : null, u.is_active ?? true];
};

const User = {
  findForLogin: async (username) =>
    (await query('SELECT user_id, password_hash, is_active FROM tbl_users WHERE username = ?', [username]))[0],

  findPasswordHash: async (userId) =>
    (await query('SELECT password_hash FROM tbl_users WHERE user_id = ?', [userId]))[0]?.password_hash,

  touchLogin: (userId) => query('UPDATE tbl_users SET last_login_at = NOW() WHERE user_id = ?', [userId]),

  setPassword: (userId, hash) => query('UPDATE tbl_users SET password_hash = ? WHERE user_id = ?', [hash, userId]),

  list: async ({ q, role, branch, status, sort, dir, limit, offset }) => {
    const w = where()
      .if(q, '(u.username LIKE ? OR u.full_name LIKE ? OR u.license_no LIKE ?)', ...(q ? Array(3).fill(like(q)) : []))
      .if(role, 'u.role = ?', role)
      .if(branch, 'u.branch_id = ?', branch)
      .if(status !== 'all' ? status : null, 'u.is_active = ?', status === 'active' ? 1 : 0);
    const rows = await query(
      `${SELECT} ${w.sql} ${orderBy({ username: 'u.username', full_name: 'u.full_name', role: 'u.role', last_login_at: 'u.last_login_at' }, sort, dir, 'u.full_name')} LIMIT ? OFFSET ?`,
      [...w.params, limit, offset],
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM tbl_users u ${w.sql}`, w.params);
    return { rows, total };
  },

  getById: async (id) => (await query(`${SELECT} WHERE u.user_id = ?`, [id]))[0],

  create: async (u, passwordHash) => (await query(
    `INSERT INTO tbl_users (username, full_name, role, branch_id, license_no, license_expiry, is_active, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [...values(u), passwordHash],
  )).insertId,

  update: (id, u) => query(
    'UPDATE tbl_users SET username = ?, full_name = ?, role = ?, branch_id = ?, license_no = ?, license_expiry = ?, is_active = ? WHERE user_id = ?',
    [...values(u), id],
  ),

  setActive: (id, active) => query('UPDATE tbl_users SET is_active = ? WHERE user_id = ?', [active, id]),

  countActiveOwners: async () =>
    (await query("SELECT COUNT(*) AS n FROM tbl_users WHERE role = 'manager' AND branch_id IS NULL AND is_active = 1"))[0].n,

  /** Pharmacist licenses that have expired or expire within the given number of days. */
  licenseAlerts: (days, branchId) => query(
    `${SELECT} WHERE u.role = 'pharmacist' AND u.is_active = 1 AND u.license_expiry <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
       ${branchId ? 'AND u.branch_id = ?' : ''} ORDER BY u.license_expiry`,
    branchId ? [days, branchId] : [days],
  ),
};

export default User;
