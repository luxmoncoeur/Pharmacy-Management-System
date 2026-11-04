import { dashboard, reports, toCsv } from '../services/reportService.js';
import { query } from '../config/db.js';
import { ok, notFound } from '../utils/http.js';
import { paginate, pageMeta } from '../utils/pagination.js';
import { branchScope } from '../middleware/auth.js';
import { where } from '../utils/sql.js';

const today = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() + 8 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

const reportController = {
  dashboard: async (req, res) => {
    const branchId = branchScope(req, req.valid.query?.branch);
    ok(res, await dashboard(branchId, req.user.role));
  },

  run: async (req, res) => {
    const report = reports[req.params.name];
    if (!report) throw notFound('Report');
    const { branch, from = daysAgo(29), to = today(), format, days } = req.valid.query;
    const branchId = branchScope(req, branch);
    const rows = await report.run({ branchId, from, to, days });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}-${from}-to-${to}.csv"`);
      return res.send(`﻿${toCsv(report.columns, rows)}`);
    }
    ok(res, rows, `${report.title} report.`, { title: report.title, columns: report.columns.map(([key, label]) => ({ key, label })), from, to, branch: branchId });
  },

  audit: async (req, res) => {
    const { user, entity, action, from, to } = req.valid.query;
    const page = paginate(req.valid.query);
    const w = where()
      .if(user, 'a.user_id = ?', user)
      .if(entity, 'a.entity = ?', entity)
      .if(action, 'a.action = ?', action)
      .if(from, 'a.created_at >= ?', from)
      .if(to, 'a.created_at < DATE_ADD(?, INTERVAL 1 DAY)', to);
    const rows = await query(
      `SELECT a.*, u.full_name AS user_name, u.username FROM tbl_audit_log a LEFT JOIN tbl_users u ON u.user_id = a.user_id
       ${w.sql} ORDER BY a.created_at DESC, a.log_id DESC LIMIT ? OFFSET ?`, [...w.params, page.limit, page.offset],
    );
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM tbl_audit_log a ${w.sql}`, w.params);
    ok(res, rows, 'Audit log fetched.', pageMeta(page, total));
  },
};

export default reportController;
