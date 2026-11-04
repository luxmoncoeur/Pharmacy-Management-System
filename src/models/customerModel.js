import { query } from '../config/db.js';
import { where, like, orderBy } from '../utils/sql.js';

const SELECT = `SELECT c.*, TIMESTAMPDIFF(YEAR, c.birthdate, CURDATE()) AS age,
                       CONCAT(c.firstname, ' ', c.lastname) AS full_name
                  FROM tbl_customers c`;

const Customer = {
  list: async ({ q, status, discount, sort, dir, limit, offset }) => {
    const w = where()
      .if(q, "(CONCAT(c.firstname, ' ', c.lastname) LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.discount_id_no LIKE ?)", ...(q ? Array(4).fill(like(q)) : []))
      .if(status !== 'all' ? status : null, 'c.is_active = ?', status === 'active' ? 1 : 0)
      .if(discount, 'c.discount_id_type = ?', discount);
    const rows = await query(
      `${SELECT} ${w.sql} ${orderBy({ lastname: 'c.lastname', firstname: 'c.firstname', created_at: 'c.created_at' }, sort, dir, 'c.lastname')}, c.firstname LIMIT ? OFFSET ?`,
      [...w.params, limit, offset],
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM tbl_customers c ${w.sql}`, w.params);
    return { rows, total };
  },
  getById: async (id) => (await query(`${SELECT} WHERE c.customer_id = ?`, [id]))[0],
  create: async (c) => (await query(
    'INSERT INTO tbl_customers (firstname, lastname, birthdate, phone, email, address, discount_id_type, discount_id_no, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [c.firstname, c.lastname, c.birthdate ?? null, c.phone ?? null, c.email ?? null, c.address ?? null, c.discount_id_type, c.discount_id_type === 'none' ? null : c.discount_id_no, c.is_active ?? true],
  )).insertId,
  update: (id, c) => query(
    'UPDATE tbl_customers SET firstname = ?, lastname = ?, birthdate = ?, phone = ?, email = ?, address = ?, discount_id_type = ?, discount_id_no = ?, is_active = ? WHERE customer_id = ?',
    [c.firstname, c.lastname, c.birthdate ?? null, c.phone ?? null, c.email ?? null, c.address ?? null, c.discount_id_type, c.discount_id_type === 'none' ? null : c.discount_id_no, c.is_active ?? true, id],
  ),
  setActive: (id, active) => query('UPDATE tbl_customers SET is_active = ? WHERE customer_id = ?', [active, id]),
  history: async (id, branchId) => {
    const params = branchId ? [id, branchId] : [id];
    const branchSql = branchId ? 'AND s.branch_id = ?' : '';
    const sales = await query(
      `SELECT s.sale_id, s.receipt_no, s.total, s.status, s.discount_type, s.created_at, b.name AS branch_name
         FROM tbl_sales s JOIN tbl_branches b ON b.branch_id = s.branch_id
        WHERE s.customer_id = ? ${branchSql} ORDER BY s.created_at DESC LIMIT 50`, params,
    );
    const prescriptions = await query(
      `SELECT p.prescription_id, p.doctor_name, p.date_issued, p.status, p.created_at,
              (SELECT COUNT(*) FROM tbl_prescribed_items i WHERE i.prescription_id = p.prescription_id) AS item_count
         FROM tbl_prescription p WHERE p.customer_id = ? ${branchSql.replace('s.', 'p.')} ORDER BY p.created_at DESC LIMIT 50`, params,
    );
    return { sales, prescriptions };
  },
};

export default Customer;
