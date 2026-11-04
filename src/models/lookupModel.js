import { query } from '../config/db.js';

// Categories and suppliers are plain text on medicines and lots. These lists only feed the
// suggestions shown while typing, so staff reuse the same spelling.
export const Lookup = {
  categories: () => query(
    `SELECT category AS name, SUM(is_active = 1) AS medicine_count
       FROM tbl_medicines GROUP BY category ORDER BY category`,
  ),
  suppliers: () => query(
    `SELECT supplier AS name, COUNT(*) AS delivery_count
       FROM tbl_batches WHERE supplier IS NOT NULL AND supplier <> '' GROUP BY supplier ORDER BY supplier`,
  ),
};
