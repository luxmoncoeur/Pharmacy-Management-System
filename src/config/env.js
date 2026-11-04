import 'dotenv/config';

const isTest = process.env.NODE_ENV === 'test';

export const env = {
  port: Number(process.env.PORT) || 3000,
  isProduction: process.env.NODE_ENV === 'production',
  isTest,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: isTest ? (process.env.DB_NAME_TEST || 'pharmacy_pms_test') : (process.env.DB_NAME || 'pharmacy_pms'),
  },
  sessionSecret: process.env.SESSION_SECRET,
};

if (!env.sessionSecret || env.sessionSecret.startsWith('change-me')) {
  if (env.isProduction) throw new Error('SESSION_SECRET must be set in production.');
  env.sessionSecret = 'dev-only-insecure-secret';
}
