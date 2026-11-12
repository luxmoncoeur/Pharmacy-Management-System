import { html } from './dom.js';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
const number = new Intl.NumberFormat('en-PH');
const compact = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (n) => peso.format(Number(n) || 0);
export const num = (n) => number.format(Number(n) || 0);
export const compactMoney = (n) => (Math.abs(n) >= 10000 ? `₱${compact.format(n)}` : money(n));

// MySQL dates arrive as "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" in Philippine time; parse without a UTC shift.
const parse = (s) => {
  if (!s) return null;
  const [d, t = '00:00:00'] = String(s).split(' ');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm);
};

export const date = (s) => (s ? parse(s).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '');
export const shortDate = (s) => (s ? parse(s).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '');
export const dateTime = (s) => (s ? parse(s).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
export const time = (s) => (s ? parse(s).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '');

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const daysFromToday = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const NEAR_EXPIRY_DAYS = 90;

/** The expiry pill: days left, colored by urgency, with the date for precision. */
export function expiryPill(expiryDate, days) {
  if (!expiryDate) return html`<span class="expiry none">No stock</span>`;
  const d = Number(days);
  const cls = d <= 0 ? 'expired' : d <= NEAR_EXPIRY_DAYS ? 'near' : '';
  const label = d <= 0 ? (d === 0 ? 'Expires today' : `Expired ${-d}d ago`) : d < 60 ? `${d}d left` : `${Math.round(d / 30)}mo left`;
  return html`<span class="expiry ${cls}" title="Expires ${date(expiryDate)}">${label}<span class="date">${shortDate(expiryDate)}</span></span>`;
}

const PILLS = {
  in: ['ok', 'In stock'], low: ['warn', 'Low stock'], out: ['danger', 'Out of stock'],
  pending: ['warn', 'Needs checking'], verified: ['info', 'Ready to give out'], partially_dispensed: ['info', 'Partly given out'],
  dispensed: ['ok', 'Given out'], rejected: ['danger', 'Rejected'],
  completed: ['ok', 'Completed'], voided: ['danger', 'Voided'],
  active: ['ok', 'Active'], inactive: ['', 'Inactive'],
};

export function statusPill(status) {
  const [tone, label] = PILLS[status] ?? ['', status];
  return html`<span class="pill ${tone ? `pill-${tone}` : ''}">${label}</span>`;
}

export const activePill = (isActive) => statusPill(isActive ? 'active' : 'inactive');

export const medicineName = (m) => `${m.generic_name} ${m.strength}`;
export const medicineSub = (m) => [m.brand, m.dosage_form].filter(Boolean).join(' · ');

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export const ROLE_LABELS = { manager: 'Manager', pharmacist: 'Pharmacist', cashier: 'Cashier' };
/** "Owner" for a manager with no branch, otherwise the role name. */
export const roleLabel = (u) => (u.role === 'manager' && !u.branch_id ? 'Owner' : ROLE_LABELS[u.role] ?? u.role);
export const PAYMENT_LABELS = { cash: 'Cash', gcash: 'GCash', card: 'Card' };
export const DISCOUNT_LABELS = { none: 'None', senior: 'Senior citizen', pwd: 'PWD' };
export const MOVEMENT_LABELS = {
  receive: 'Delivery received', sale: 'Sold', adjust: 'Count corrected', transfer_out: 'Sent to another branch', transfer_in: 'Received from another branch',
  void_return: 'Returned (sale cancelled)', write_off: 'Removed (expired or damaged)',
};

/** "just now", "5 min ago", "3 h ago", or the date: for notification times. Midnight-dated items read as "today". */
export function ago(s) {
  const d = parse(s);
  if (!d) return '';
  if (String(s).endsWith('00:00:00') && d.toDateString() === new Date().toDateString()) return 'today';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return shortDate(s);
}
