import { query } from '../config/db.js';
import { where } from '../utils/sql.js';

const SELECT = `
  SELECT t.*, fb.name AS from_branch_name, tb.name AS to_branch_name,
         ru.full_name AS requested_by_name, du.full_name AS dispatched_by_name, xu.full_name AS received_by_name,
         (SELECT SUM(ti.quantity) FROM tbl_transfer_items ti WHERE ti.transfer_id = t.transfer_id) AS total_units,
         (SELECT COUNT(DISTINCT ti.medicine_id) FROM tbl_transfer_items ti WHERE ti.transfer_id = t.transfer_id) AS medicine_count
    FROM tbl_transfers t
    JOIN tbl_branches fb ON fb.branch_id = t.from_branch_id
    JOIN tbl_branches tb ON tb.branch_id = t.to_branch_id
    JOIN tbl_users ru ON ru.user_id = t.requested_by
    LEFT JOIN tbl_users du ON du.user_id = t.dispatched_by
    LEFT JOIN tbl_users xu ON xu.user_id = t.received_by`;

const Transfer = {
  list: async ({ status, limit, offset }, branchId) => {
    const w = where()
      .if(branchId, '(t.from_branch_id = ? OR t.to_branch_id = ?)', branchId, branchId)
      .if(status, 't.status = ?', status);
    const rows = await query(`${SELECT} ${w.sql} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`, [...w.params, limit, offset]);
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM tbl_transfers t ${w.sql}`, w.params);
    return { rows, total };
  },

  getById: async (id) => {
    const [t] = await query(`${SELECT} WHERE t.transfer_id = ?`, [id]);
    if (!t) return null;
    t.items = await query(
      `SELECT ti.*, m.generic_name, m.brand, m.strength, b.batch_no, b.expiry_date
         FROM tbl_transfer_items ti
         JOIN tbl_medicines m ON m.medicine_id = ti.medicine_id
         LEFT JOIN tbl_batches b ON b.batch_id = ti.batch_id
        WHERE ti.transfer_id = ? ORDER BY ti.transfer_item_id`, [id],
    );
    return t;
  },
};

export default Transfer;
