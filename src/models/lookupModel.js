import { query } from '../config/db.js';

export const Category = {
  list: () => query(
    `SELECT c.*, (SELECT COUNT(*) FROM tbl_medicines m WHERE m.category_id = c.category_id AND m.is_active = 1) AS medicine_count
       FROM tbl_categories c ORDER BY c.name`,
  ),
  getById: async (id) => (await query('SELECT * FROM tbl_categories WHERE category_id = ?', [id]))[0],
  create: async ({ name }) => (await query('INSERT INTO tbl_categories (name) VALUES (?)', [name])).insertId,
  update: (id, { name }) => query('UPDATE tbl_categories SET name = ? WHERE category_id = ?', [name, id]),
  remove: (id) => query('DELETE FROM tbl_categories WHERE category_id = ?', [id]),
};

export const Supplier = {
  list: (status = 'active') => query(
    `SELECT s.*, (SELECT COUNT(*) FROM tbl_batches b WHERE b.supplier_id = s.supplier_id) AS batch_count
       FROM tbl_suppliers s ${status === 'all' ? '' : 'WHERE s.is_active = ?'} ORDER BY s.name`,
    status === 'all' ? [] : [status === 'active' ? 1 : 0],
  ),
  getById: async (id) => (await query('SELECT * FROM tbl_suppliers WHERE supplier_id = ?', [id]))[0],
  create: async (s) => (await query(
    'INSERT INTO tbl_suppliers (name, contact_person, phone, email, address, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [s.name, s.contact_person ?? null, s.phone ?? null, s.email ?? null, s.address ?? null, s.is_active ?? true],
  )).insertId,
  update: (id, s) => query(
    'UPDATE tbl_suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, is_active = ? WHERE supplier_id = ?',
    [s.name, s.contact_person ?? null, s.phone ?? null, s.email ?? null, s.address ?? null, s.is_active ?? true, id],
  ),
  setActive: (id, active) => query('UPDATE tbl_suppliers SET is_active = ? WHERE supplier_id = ?', [active, id]),
};
