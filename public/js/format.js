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
  pending: ['warn', 'Awaiting review'], verified: ['info', 'Ready to dispense'], partially_dispensed: ['info', 'Partly dispensed'],
  dispensed: ['ok', 'Dispensed'], rejected: ['danger', 'Rejected'],
  completed: ['ok', 'Completed'], voided: ['danger', 'Voided'],
  requested: ['warn', 'Requested'], in_transit: ['info', 'In transit'], received: ['ok', 'Received'], cancelled: ['', 'Cancelled'],
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

export const ROLE_LABELS = { admin: 'Administrator', manager: 'Branch manager', pharmacist: 'Pharmacist', cashier: 'Cashier' };
export const PAYMENT_LABELS = { cash: 'Cash', gcash: 'GCash', card: 'Card' };
export const DISCOUNT_LABELS = { none: 'None', senior: 'Senior citizen', pwd: 'PWD' };
export const MOVEMENT_LABELS = {
  receive: 'Received', sale: 'Sold', adjust: 'Adjusted', transfer_out: 'Transferred out', transfer_in: 'Transferred in',
  void_return: 'Returned (void)', write_off: 'Written off',
};
