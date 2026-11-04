import { createApp } from './app.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';

try {
  await pool.query('SELECT 1');
} catch (err) {
  console.error(`Cannot connect to MySQL at ${env.db.host}:${env.db.port}/${env.db.database}: ${err.message}`);
  console.error('Check that MySQL is running and that .env is correct, then run "npm run db:setup".');
  process.exit(1);
}

createApp().listen(env.port, () => {
  console.log(`Pharmacy Management System running at http://localhost:${env.port}`);
});
