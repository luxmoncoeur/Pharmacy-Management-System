import { api } from '../api.js';
import { html } from '../dom.js';
import { icon } from '../icons.js';
import { money, medicineName, medicineSub, expiryPill, num } from '../format.js';
import { session } from '../session.js';

export const pageHeader = (title, description, actions = '') => html`
  <div class="page-header">
    <div><h1>${title}</h1>${description ? html`<p>${description}</p>` : ''}</div>
    ${actions ? html`<div class="page-actions">${actions}</div>` : ''}
  </div>`;

/** Lets the rest of the shell (sidebar counts) know that data changed. */
export const dataChanged = () => window.dispatchEvent(new Event('pms:data-changed'));

let branchCache = null;
export async function branches() {
  branchCache ??= api.get('/branches').then((r) => r.data);
  return branchCache;
}

/** Admins can look at one branch or all; everyone else is fixed to their own branch, so no control is shown. */
export async function branchFilter(name = 'branch', { allLabel = 'All branches' } = {}) {
  if (session.user.role !== 'admin') return '';
  const list = await branches();
  return html`<label class="sr-only" for="filter-${name}">Branch</label>
    <select class="select" id="filter-${name}" name="${name}" data-filter>
      <option value="">${allLabel}</option>
      ${list.map((b) => html`<option value="${b.branch_id}">${b.name}</option>`)}
    </select>`;
}

export const searchMedicines = async (q, extra = {}) =>
  (await api.get('/medicines', { q, limit: 12, sort: 'generic_name', ...extra })).data;

export const medicineOption = (m) => html`
  <span><strong>${medicineName(m)}</strong> ${m.requires_prescription ? html`<span class="rx-tag">Rx</span>` : ''}
    <span class="secondary-line">${medicineSub(m)} · ${num(m.stock_on_hand)} in stock</span></span>
  <span class="num">${money(m.price)}</span>`;

export const searchCustomers = async (q) => (await api.get('/customers', { q, limit: 10 })).data;

export const customerOption = (c) => html`
  <span><strong>${c.full_name}</strong>
    <span class="secondary-line">${[c.phone, c.discount_id_type !== 'none' ? (c.discount_id_type === 'senior' ? 'Senior citizen' : 'PWD') : ''].filter(Boolean).join(' · ') || 'No contact on file'}</span></span>`;

export const medicineCell = (m) => html`
  <span class="primary-cell">${medicineName(m)}</span> ${m.requires_prescription ? html`<span class="rx-tag" title="Prescription required">Rx</span>` : ''}
  <span class="secondary-line">${medicineSub(m)}</span>`;

export { expiryPill, icon };
