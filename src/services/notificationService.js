import { query } from '../config/db.js';
import Inventory from '../models/inventoryModel.js';
import User from '../models/userModel.js';
import { isOwner } from '../middleware/auth.js';
import { phToday } from '../validators/common.js';

// How far back event notifications (reviewed prescriptions, voided sales) reach.
const RECENT_DAYS = 3;
const scope = (column, branchId) => (branchId ? { sql: `AND ${column} = ?`, params: [branchId] } : { sql: '', params: [] });
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Builds the notification list for the signed-in user from data already in the database (no table of its own).
 * Events carry the time they happened. Standing problems (stock, licenses) are dated today at midnight and their
 * id includes the count, so they show as new once a day or whenever the count changes.
 * "Read" is tracked by the browser, so nothing here changes the database.
 */
export async function getNotifications(req, branchId) {
  const { user } = req;
  const owner = isOwner(user);
  const showBranch = owner && !branchId;
  const at = (name) => (showBranch && name ? ` · ${name}` : '');
  const today = phToday();
  const startOfDay = `${today} 00:00:00`;
  const items = [];

  const pb = scope('p.branch_id', branchId);
  const [{ pending }] = await query(`SELECT COUNT(*) AS pending FROM tbl_prescription p WHERE p.status = 'pending' ${pb.sql}`, pb.params);

  // Prescriptions waiting for a pharmacist: shown to those who check them or run the branch.
  if (user.role !== 'cashier') {
    const rows = await query(
      `SELECT p.prescription_id, p.created_at, CONCAT(c.firstname, ' ', c.lastname) AS customer_name, u.full_name AS created_by_name, br.name AS branch_name
         FROM tbl_prescription p
         JOIN tbl_customers c ON c.customer_id = p.customer_id
         JOIN tbl_users u ON u.user_id = p.created_by
         JOIN tbl_branches br ON br.branch_id = p.branch_id
        WHERE p.status = 'pending' ${pb.sql}
        ORDER BY p.created_at DESC LIMIT 20`, pb.params,
    );
    rows.forEach((r) => items.push({
      id: `rx_pending:${r.prescription_id}`, type: 'rx_pending', severity: 'warn',
      title: `Prescription #${r.prescription_id} needs checking`,
      body: `${r.customer_name} · recorded by ${r.created_by_name}${at(r.branch_name)}`,
      link: `#/prescriptions/${r.prescription_id}`, at: r.created_at,
    }));
  }

  // Prescriptions this person recorded that someone else has now checked.
  const reviewed = await query(
    `SELECT p.prescription_id, p.status, p.rejection_reason, p.reviewed_at, CONCAT(c.firstname, ' ', c.lastname) AS customer_name, rv.full_name AS reviewer
       FROM tbl_prescription p
       JOIN tbl_customers c ON c.customer_id = p.customer_id
       JOIN tbl_users rv ON rv.user_id = p.reviewed_by
      WHERE p.created_by = ? AND p.reviewed_by <> ? AND p.status IN ('verified', 'rejected')
        AND p.reviewed_at >= DATE_SUB(NOW(), INTERVAL ${RECENT_DAYS} DAY)
      ORDER BY p.reviewed_at DESC LIMIT 20`, [user.user_id, user.user_id],
  );
  reviewed.forEach((r) => items.push({
    id: `rx_reviewed:${r.prescription_id}:${r.status}`, type: 'rx_reviewed', severity: r.status === 'rejected' ? 'danger' : 'info',
    title: r.status === 'rejected' ? `Prescription #${r.prescription_id} was rejected` : `Prescription #${r.prescription_id} is ready to give out`,
    body: r.status === 'rejected' ? `${r.customer_name} · ${r.reviewer}: ${r.rejection_reason}` : `${r.customer_name} · checked by ${r.reviewer}`,
    link: `#/prescriptions/${r.prescription_id}`, at: r.reviewed_at,
  }));

  if (user.role === 'manager') {
    const sb = scope('s.branch_id', branchId);
    const voids = await query(
      `SELECT s.sale_id, s.receipt_no, s.total, s.void_reason, s.voided_at, v.full_name AS voided_by_name, br.name AS branch_name
         FROM tbl_sales s JOIN tbl_users v ON v.user_id = s.voided_by JOIN tbl_branches br ON br.branch_id = s.branch_id
        WHERE s.status = 'voided' AND s.voided_by <> ? AND s.voided_at >= DATE_SUB(NOW(), INTERVAL ${RECENT_DAYS} DAY) ${sb.sql}
        ORDER BY s.voided_at DESC LIMIT 20`, [user.user_id, ...sb.params],
    );
    voids.forEach((s) => items.push({
      id: `sale_voided:${s.sale_id}`, type: 'sale_voided', severity: 'warn',
      title: `Sale ${s.receipt_no} was voided`,
      body: `₱${Number(s.total).toFixed(2)} · by ${s.voided_by_name}: ${s.void_reason}${at(s.branch_name)}`,
      link: `#/sales/${s.sale_id}`, at: s.voided_at,
    }));

    const licenses = await User.licenseAlerts(60, branchId);
    licenses.forEach((p) => items.push({
      id: `license:${p.user_id}:${today}`, type: 'license', severity: p.license_days_left < 0 ? 'danger' : 'warn',
      title: p.license_days_left < 0 ? `${p.full_name}'s PRC license has expired` : `${p.full_name}'s PRC license expires in ${plural(p.license_days_left, 'day')}`,
      body: `License ${p.license_no}. They cannot verify prescriptions once it expires. Update it in Settings.${at(p.branch_name)}`,
      link: '#/settings', at: startOfDay,
    }));
  }

  const alerts = await Inventory.alerts(branchId);
  const out = alerts.low_stock.filter((m) => Number(m.stock_on_hand) === 0);
  const low = alerts.low_stock.length - out.length;
  if (user.role !== 'cashier') {
    const stock = [
      ['stock_expired', alerts.expired.length, 'danger', `${plural(alerts.expired.length, 'lot')} expired`, 'Take them off the shelf and remove them as expired.', '#/stock?stock=expired'],
      ['stock_out', out.length, 'danger', `${plural(out.length, 'medicine')} out of stock`, 'Receive a delivery or ask another branch to send some.', '#/stock?stock=out'],
      ['stock_low', low, 'warn', `${plural(low, 'medicine')} running low`, 'At or below the reorder level. See the reorder list.', '#/stock?stock=low'],
      ['stock_expiring', alerts.near_expiry.length, 'info', `${plural(alerts.near_expiry.length, 'lot')} expiring within ${alerts.near_expiry_days} days`, 'Sell these first or send them to a branch that needs them.', '#/stock?stock=expiring'],
    ];
    stock.filter(([, n]) => n > 0).forEach(([type, n, severity, title, body, link]) => items.push({
      id: `${type}:${today}:${n}`, type, severity, title, body, link, at: startOfDay,
    }));
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return {
    items,
    counts: {
      prescriptions: Number(pending),
      stock: alerts.expired.length + alerts.near_expiry.length + alerts.low_stock.length,
    },
  };
}
