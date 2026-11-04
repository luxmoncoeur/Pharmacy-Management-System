import mysql from 'mysql2/promise';
import { env } from './env.js';
import { PH_TIMEZONE } from './pricing.js';

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
  dateStrings: true,
  timezone: PH_TIMEZONE,
});

// Keep CURDATE()/NOW() in Philippine time regardless of the MySQL server's zone.
pool.on('connection', (conn) => conn.query(`SET time_zone = '${PH_TIMEZONE}'`));

export const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

/**
 * Runs fn(conn) inside a transaction. Any thrown error rolls everything back,
 * so a sale can never deduct stock without also being recorded.
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
