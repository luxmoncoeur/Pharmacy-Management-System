import { dashboard, reports, toCsv } from '../services/reportService.js';
import { ok, notFound } from '../utils/http.js';
import { branchScope, isOwner } from '../middleware/auth.js';
import { phToday as today } from '../validators/common.js';

const daysAgo = (n) => new Date(Date.now() + 8 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);

const reportController = {
  dashboard: async (req, res) => {
    const branchId = branchScope(req, req.valid.query?.branch);
    ok(res, await dashboard(branchId, { owner: isOwner(req.user), manager: req.user.role === 'manager' }));
  },

  run: async (req, res) => {
    const report = reports[req.params.name];
    if (!report) throw notFound('Report');
    const { branch, from = daysAgo(29), to = today(), format } = req.valid.query;
    const branchId = branchScope(req, branch);
    const rows = await report.run({ branchId, from, to });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}-${from}-to-${to}.csv"`);
      return res.send(`﻿${toCsv(report.columns, rows)}`);
    }
    ok(res, rows, `${report.title} report.`, { title: report.title, description: report.description, columns: report.columns.map(([key, label]) => ({ key, label })), from, to, branch: branchId });
  },

};

export default reportController;
