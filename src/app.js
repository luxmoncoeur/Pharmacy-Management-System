import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import helmet from 'helmet';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { sameOriginOnly } from './middleware/security.js';

const MySQLStore = MySQLStoreFactory(session);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        // Width/height of chart bars and skeleton rows are set per element; scripts remain 'self' only.
        styleSrcAttr: ["'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  }));
  app.use(express.json({ limit: '100kb' }));

  app.use(session({
    name: 'pms.sid',
    secret: env.sessionSecret,
    store: env.isTest ? undefined : new MySQLStore({ createDatabaseTable: true, clearExpired: true }, pool),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, sameSite: 'strict', secure: env.isProduction, maxAge: 10 * 60 * 60 * 1000 },
  }));

  app.use('/api', sameOriginOnly, apiRoutes, notFoundHandler);
  app.use(express.static(new URL('../public', import.meta.url).pathname, { extensions: ['html'] }));
  app.use(errorHandler);
  return app;
}
