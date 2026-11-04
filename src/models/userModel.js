import { query } from '../config/db.js';
import { where, like, orderBy } from '../utils/sql.js';

const SELECT = `SELECT u.user_id, u.username, u.full_name, u.role, u.branch_id, b.name AS branch_name,
                       u.is_active, u.last_login_at, u.created_at
                  FROM tbl_users u LEFT JOIN tbl_branches b ON b.branch_id = u.branch_id`;

const User = {
  findForLogin: async (username) =>
    (await query('SELECT user_id, password_hash, is_active FROM tbl_users WHERE username = ?', [username]))[0],

  findPasswordHash: async (userId) =>
    (await query('SELECT password_hash FROM tbl_users WHERE user_id = ?', [userId]))[0]?.password_hash,

  touchLogin: (userId) => query('UPDATE tbl_users SET last_login_at = NOW() WHERE user_id = ?', [userId]),

  setPassword: (userId, hash) => query('UPDATE tbl_users SET password_hash = ? WHERE user_id = ?', [hash, userId]),

  list: async ({ q, role, branch, status, sort, dir, limit, offset }) => {
    const w = where()
      .if(q, '(u.username LIKE ? OR u.full_name LIKE ?)', q && like(q), q && like(q))
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

  create: async (u, passwordHash) => {
    const r = await query(
      'INSERT INTO tbl_users (username, password_hash, full_name, role, branch_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [u.username, passwordHash, u.full_name, u.role, u.role === 'admin' ? null : u.branch_id, u.is_active ?? true],
    );
    return r.insertId;
  },

  update: (id, u) => query(
    'UPDATE tbl_users SET username = ?, full_name = ?, role = ?, branch_id = ?, is_active = ? WHERE user_id = ?',
    [u.username, u.full_name, u.role, u.role === 'admin' ? null : u.branch_id, u.is_active ?? true, id],
  ),

  setActive: (id, active) => query('UPDATE tbl_users SET is_active = ? WHERE user_id = ?', [active, id]),

  countActiveAdmins: async () => (await query("SELECT COUNT(*) AS n FROM tbl_users WHERE role = 'admin' AND is_active = 1"))[0].n,
};

export default User;
