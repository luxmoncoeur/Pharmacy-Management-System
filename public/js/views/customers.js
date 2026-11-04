import { api } from '../api.js';
import { html, render as draw, $, on } from '../dom.js';
import { icon } from '../icons.js';
import { money, date, dateTime, statusPill, activePill, DISCOUNT_LABELS } from '../format.js';
import { can, ROLES } from '../session.js';
import { createList } from '../ui/list.js';
import { formDialog } from '../ui/formDialog.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { toast, toastError } from '../ui/toast.js';
import { pageHeader } from './shared.js';
import { openReceipt } from './receipt.js';

const defs = [
  { name: 'firstname', label: 'First name', required: true, attrs: { maxlength: 60 } },
  { name: 'lastname', label: 'Last name', required: true, attrs: { maxlength: 60 } },
  { name: 'phone', label: 'Mobile number (optional)', type: 'tel', span: true, attrs: { maxlength: 20 }, placeholder: '09XX XXX XXXX' },
  { name: 'discount_id_type', label: 'Senior Citizen or PWD?', type: 'select', options: [['none', 'No'], ['senior', 'Senior citizen'], ['pwd', 'PWD']] },
  { name: 'discount_id_no', label: 'ID number', hint: 'Needed for the 20% discount', attrs: { maxlength: 40 } },
];

export async function render(container, { id }) {
  draw(container, html`
    ${pageHeader('Customers', 'Patients and regular buyers. Save a Senior Citizen or PWD ID here once, and the discount is ready at Sell.',
      html`<button class="btn btn-primary" type="button" id="add-customer">${icon('user-plus')}Add customer</button>`)}
    <section class="panel" id="customer-list"></section>`);

  const list = createList($('#customer-list', container), {
    endpoint: '/customers',
    caption: 'Customers',
    toolbar: html`
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="cust-q">Search customers</label>
        <input class="input" id="cust-q" type="search" name="q" data-filter placeholder="Name, phone, or ID number"></div>
      <label class="sr-only" for="cust-discount">Discount</label>
      <select class="select" id="cust-discount" name="discount" data-filter><option value="">Any discount</option><option value="senior">Senior citizen</option><option value="pwd">PWD</option><option value="none">No discount ID</option></select>
      <label class="check"><input type="checkbox" name="status" value="all" data-filter> Show archived</label>`,
    columns: [
      { label: 'Name', sortKey: 'lastname', render: (c) => html`<span class="primary-cell">${c.lastname}, ${c.firstname}</span>` },
      { label: 'Phone', render: (c) => c.phone ?? html`<span class="subtle">None</span>` },
      { label: 'Discount', render: (c) => (c.discount_id_type === 'none' ? html`<span class="subtle">None</span>` : html`<span class="pill pill-info no-dot">${DISCOUNT_LABELS[c.discount_id_type]}</span><span class="secondary-line mono">${c.discount_id_no}</span>`) },
      { label: 'Added', sortKey: 'created_at', render: (c) => date(c.created_at) },
      { label: 'Status', render: (c) => activePill(c.is_active) },
    ],
    rowKey: (c) => c.customer_id,
    onRowClick: (cid) => openCustomer(cid, list),
    empty: { icon: 'users', title: 'No customers yet', message: 'Add customers to track prescriptions and apply Senior Citizen or PWD discounts.' },
  });

  $('#add-customer', container).addEventListener('click', () => editCustomer(null, list));
  if (id) openCustomer(id, list);
}

function editCustomer(customer, list) {
  formDialog({
    title: customer ? `Edit ${customer.full_name}` : 'Add customer',
    defs: customer ? [...defs, { name: 'is_active', label: 'Active customer', type: 'checkbox', span: true }] : defs,
    values: customer ?? {},
    endpoint: '/customers',
    id: customer?.customer_id,
    submitLabel: customer ? 'Save changes' : 'Add customer',
    onSaved: () => list.reload(),
  });
}

async function openCustomer(customerId, list) {
  try {
    const [{ data: c }, { data: history }] = await Promise.all([api.get(`/customers/${customerId}`), api.get(`/customers/${customerId}/history`)]);
    const dlg = openDialog({
      title: c.full_name,
      description: c.is_active ? `Customer since ${date(c.created_at)}` : 'Archived customer',
      size: 'wide',
      body: html`
        <dl class="details">
          <dt>Phone</dt><dd>${c.phone ?? 'Not recorded'}</dd>
          <dt>Discount ID</dt><dd>${c.discount_id_type === 'none' ? 'None' : `${DISCOUNT_LABELS[c.discount_id_type]} · ${c.discount_id_no}`}</dd>
        </dl>
        <section>
          <h3>Purchases</h3>
          ${history.sales.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Receipt</th><th>Date</th><th>Branch</th><th class="num">Total</th><th>Status</th></tr></thead>
            <tbody>${history.sales.map((s) => html`<tr data-sale="${s.sale_id}" tabindex="0" style="cursor:pointer"><td class="mono">${s.receipt_no}</td><td>${dateTime(s.created_at)}</td><td>${s.branch_name}</td><td class="num">${money(s.total)}</td><td>${statusPill(s.status)}</td></tr>`)}</tbody></table></div>`
            : html`<p class="subtle small">No purchases yet.</p>`}
        </section>
        <section>
          <h3>Prescriptions</h3>
          ${history.prescriptions.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>No.</th><th>Doctor</th><th>Date written</th><th class="num">Medicines</th><th>Status</th></tr></thead>
            <tbody>${history.prescriptions.map((p) => html`<tr><td><a href="#/prescriptions/${p.prescription_id}">#${p.prescription_id}</a></td><td>${p.doctor_name}</td><td>${date(p.date_issued)}</td><td class="num">${p.item_count}</td><td>${statusPill(p.status)}</td></tr>`)}</tbody></table></div>`
            : html`<p class="subtle small">No prescriptions on file.</p>`}
        </section>`,
      footer: html`
        ${c.is_active && can(...ROLES.DISPENSING) ? html`<button class="btn btn-ghost" type="button" data-archive>${icon('archive')}Archive</button>` : ''}
        <span class="spacer"></span>
        <button class="btn" type="button" data-edit>${icon('pencil')}Edit</button>
        <button class="btn btn-primary" type="button" data-close>Done</button>`,
    });
    on(dlg.el, 'click', '[data-sale]', (_e, tr) => openReceipt(tr.dataset.sale));
    on(dlg.el, 'keydown', '[data-sale]', (e, tr) => { if (e.key === 'Enter') openReceipt(tr.dataset.sale); });
    on(dlg.el, 'click', 'a[href^="#/"]', () => dlg.close());
    dlg.el.querySelector('[data-edit]').addEventListener('click', () => { dlg.close(); editCustomer(c, list); });
    dlg.el.querySelector('[data-archive]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Archive ${c.full_name}?`,
        message: 'They will no longer appear in customer search at Sell. Their sales and prescriptions are kept.',
        confirmLabel: 'Archive customer',
        danger: true,
        onConfirm: () => api.del(`/customers/${c.customer_id}`),
      });
      if (ok) { dlg.close(); toast('Customer archived.'); list.reload(); }
    });
  } catch (err) {
    toastError(err);
  }
}
