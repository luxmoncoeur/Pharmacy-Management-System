import { dashboard, reports, toCsv, cashSummary } from '../services/reportService.js';
import { query } from '../config/db.js';
import { ok, notFound, forbidden, badRequest } from '../utils/http.js';
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
      // A byte-order mark so Excel opens the file as UTF-8 (₱ and ñ display correctly).
      return res.send(`\uFEFF${toCsv(report.columns, rows)}`);
    }
    ok(res, rows, `${report.title} report.`, { title: report.title, description: report.description, columns: report.columns.map(([key, label]) => ({ key, label })), from, to, branch: branchId });
  },

  /** Cashiers and pharmacists see their own day; a branch manager sees anyone at the branch; the owner sees anyone. */
  cash: async (req, res) => {
    const me = req.user;
    const manager = me.role === 'manager';
    const { cashier, date } = req.valid.query;
    const day = date ?? today();
    if (!cashier && isOwner(me)) throw badRequest('Choose whose sales to count.', { cashier: 'Choose a staff member.' });
    const targetId = cashier ?? me.user_id;
    if (!manager && Number(targetId) !== Number(me.user_id)) throw forbidden('You can only count your own sales.');
    if (!manager && day !== today()) throw forbidden('Only a manager can look at a past day.');

    const [person] = await query(
      `SELECT u.user_id, u.full_name, u.role, u.branch_id, b.name AS branch_name, b.address AS branch_address
         FROM tbl_users u LEFT JOIN tbl_branches b ON b.branch_id = u.branch_id WHERE u.user_id = ?`, [targetId],
    );
    if (!person) throw notFound('Staff member');
    if (!person.branch_id) throw badRequest('This person has no till. Choose someone who works at a branch.', { cashier: 'Choose someone at a branch.' });
    if (manager && !isOwner(me) && person.branch_id !== me.branch_id) throw forbidden('This person works at another branch.');

    ok(res, { date: day, person, ...(await cashSummary(person.user_id, day)) }, 'Cash summary.');
  },
};

export default reportController;
