import { pool } from '../config/db.js';

/** Records who did what. Pass a transaction connection so the log commits or rolls back with the change. */
export async function audit(req, action, entity, entityId = null, details = null, conn = pool) {
  await conn.query(
    'INSERT INTO tbl_audit_log (user_id, action, entity, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)',
    [req.session?.user?.user_id ?? null, action, entity, entityId, details ? JSON.stringify(details) : null, req.ip],
  );
}
