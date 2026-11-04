import request from 'supertest';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/config/db.js');

export const app = createApp();
export const PASSWORD = 'Pharmacy123!';
export { pool };

/** Returns a supertest agent that keeps the session cookie of the signed-in user. */
export async function loginAs(username, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`Login failed for ${username}: ${res.status} ${res.body.message}`);
  return agent;
}

export const anon = () => request(app);

export async function sellableStock(branchId, medicineId) {
  const [[row]] = await pool.query(
    'SELECT COALESCE(SUM(qty_on_hand), 0) AS qty FROM tbl_batches WHERE branch_id = ? AND medicine_id = ? AND expiry_date > CURDATE()',
    [branchId, medicineId],
  );
  return Number(row.qty);
}

export async function ledgerMismatches() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS n FROM tbl_batches b
       LEFT JOIN (SELECT batch_id, SUM(qty_change) AS s FROM tbl_stock_movements GROUP BY batch_id) m USING (batch_id)
      WHERE b.qty_on_hand <> COALESCE(m.s, 0)`,
  );
  return Number(row.n);
}
