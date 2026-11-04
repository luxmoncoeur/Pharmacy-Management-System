// Creates the database and loads schema.sql + seed.sql. Pass --test to target the test database.
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import 'dotenv/config';

const isTest = process.argv.includes('--test');
const database = isTest ? (process.env.DB_NAME_TEST || 'pharmacy_pms_test') : (process.env.DB_NAME || 'pharmacy_pms');
const read = (name) => readFileSync(new URL(`../database/${name}`, import.meta.url), 'utf8');

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

try {
  await conn.query("SET time_zone = '+08:00'");
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${database}\``);
  await conn.query(read('schema.sql'));
  await conn.query(read('seed.sql'));
  const [[counts]] = await conn.query(
    'SELECT (SELECT COUNT(*) FROM tbl_medicines) AS medicines, (SELECT COUNT(*) FROM tbl_batches) AS batches, (SELECT COUNT(*) FROM tbl_sales) AS sales',
  );
  console.log(`Database "${database}" ready: ${counts.medicines} medicines, ${counts.batches} batches, ${counts.sales} sales.`);
} catch (err) {
  console.error(`Database setup failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
