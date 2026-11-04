import { api } from '../api.js';
import { html, render as draw, $, on } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, statusPill, expiryPill, medicineName, medicineSub, date } from '../format.js';
import { can, ROLES } from '../session.js';
import { createList } from '../ui/list.js';
import { formDialog } from '../ui/formDialog.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { toast, toastError } from '../ui/toast.js';
import { pageHeader, branchFilter, medicineCell, dataChanged } from './shared.js';
import { receiveStockDialog } from './inventory.js';

let categories = [];
const loadCategories = async () => { categories = (await api.get('/categories')).data; return categories; };

const medicineDefs = () => [
  { name: 'generic_name', label: 'Generic name', required: true, attrs: { maxlength: 120 } },
  { name: 'brand', label: 'Brand', required: true, attrs: { maxlength: 120 }, hint: 'Use "Generic" for unbranded products' },
  { name: 'strength', label: 'Strength', required: true, attrs: { maxlength: 40 }, placeholder: '500 mg' },
  { name: 'dosage_form', label: 'Dosage form', required: true, type: 'select', placeholder: 'Choose a form',
    options: ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Drops', 'Inhaler', 'Nebule', 'Injection', 'Ointment', 'Cream', 'Solution', 'Sachet'].map((f) => [f, f]) },
  { name: 'category_id', label: 'Category', required: true, type: 'select', placeholder: 'Choose a category', options: categories.map((c) => [c.category_id, c.name]) },
  { name: 'unit', label: 'Selling unit', required: true, attrs: { maxlength: 20 }, placeholder: 'tablet', hint: 'What one quantity means at the POS' },
  { name: 'price', label: 'Selling price (VAT-inclusive)', type: 'number', required: true, attrs: { min: 0.01, step: 0.01, inputmode: 'decimal' } },
  { name: 'reorder_level', label: 'Reorder level', type: 'number', required: true, value: 20, attrs: { min: 0, step: 1 }, hint: 'Flag as low stock at or below this' },
  { name: 'barcode', label: 'Barcode', attrs: { maxlength: 32, inputmode: 'numeric' } },
  { name: 'requires_prescription', label: 'Prescription required (Rx)', type: 'checkbox', hint: 'Rx medicines can only be sold against a verified prescription' },
];

export async function render(container, { id, query }) {
  await loadCategories();
  const manage = can(...ROLES.MANAGEMENT);
  draw(container, html`
    ${pageHeader('Medicines', 'Catalog, prices, and live stock from every batch on hand.',
      html`${manage ? html`<button class="btn" type="button" id="manage-categories">${icon('tags')}Categories</button>
        <button class="btn btn-primary" type="button" id="add-medicine">${icon('plus')}Add medicine</button>` : ''}`)}
    <section class="panel" id="med-list"></section>`);

  const list = createList($('#med-list', container), {
    endpoint: '/medicines',
    caption: 'Medicines',
    params: { stock: query?.stock ?? '' },
    toolbar: html`
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="med-q">Search medicines</label>
        <input class="input" id="med-q" type="search" name="q" data-filter placeholder="Generic name, brand, or barcode"></div>
      <label class="sr-only" for="med-cat">Category</label>
      <select class="select" id="med-cat" name="category" data-filter><option value="">All categories</option>${categories.map((c) => html`<option value="${c.category_id}">${c.name}</option>`)}</select>
      <label class="sr-only" for="med-rx">Type</label>
      <select class="select" id="med-rx" name="rx" data-filter><option value="">Rx and OTC</option><option value="rx">Prescription (Rx)</option><option value="otc">Over the counter</option></select>
      <label class="sr-only" for="med-stock">Stock</label>
      <select class="select" id="med-stock" name="stock" data-filter>
        <option value="">Any stock level</option>
        ${[['in', 'In stock'], ['low', 'Low stock'], ['out', 'Out of stock']].map(([v, l]) => html`<option value="${v}" ${query?.stock === v ? 'selected' : ''}>${l}</option>`)}
      </select>
      ${manage ? html`<label class="sr-only" for="med-status">Status</label>
        <select class="select" id="med-status" name="status" data-filter><option value="active">Active</option><option value="inactive">Archived</option><option value="all">All</option></select>` : ''}
      ${await branchFilter()}`,
    columns: [
      { label: 'Medicine', sortKey: 'generic_name', render: medicineCell },
      { label: 'Category', key: 'category_name' },
      { label: 'Price', num: true, sortKey: 'price', render: (m) => money(m.price) },
      { label: 'Sellable stock', num: true, sortKey: 'stock_on_hand', render: (m) => html`${num(m.stock_on_hand)} <span class="subtle small">${m.unit}</span>${m.expired_qty > 0 ? html`<span class="secondary-line" style="color:var(--danger-text)">${num(m.expired_qty)} expired</span>` : ''}` },
      { label: 'Nearest expiry', sortKey: 'nearest_expiry', render: (m) => expiryPill(m.nearest_expiry, m.days_to_expiry) },
      { label: 'Status', render: (m) => (m.is_active ? statusPill(m.stock_status) : statusPill('inactive')) },
    ],
    rowKey: (m) => m.medicine_id,
    onRowClick: (mid) => openMedicine(mid, list),
    empty: { icon: 'pill', title: 'No medicines yet', message: 'Add medicines to the catalog, then receive stock against them.' },
  });

  $('#add-medicine', container)?.addEventListener('click', () => editMedicine(null, list));
  $('#manage-categories', container)?.addEventListener('click', () => categoriesDialog(list));
  if (id) openMedicine(id, list);
}

function editMedicine(m, list) {
  formDialog({
    title: m ? `Edit ${medicineName(m)}` : 'Add medicine',
    description: m ? 'Price changes are recorded in the audit log.' : 'New medicines start with zero stock. Receive a batch to make them sellable.',
    defs: medicineDefs(),
    values: m ?? {},
    endpoint: '/medicines',
    id: m?.medicine_id,
    size: 'wide',
    submitLabel: m ? 'Save changes' : 'Add medicine',
    prepare: (d) => ({ ...d, barcode: d.barcode || null, is_active: m ? Boolean(m.is_active) : true }),
    onSaved: () => list.reload(),
  });
}

async function openMedicine(medicineId, list) {
  try {
    const [{ data: m }, { data: batches }] = await Promise.all([
      api.get(`/medicines/${medicineId}`),
      api.get('/batches', { medicine: medicineId, in_stock: 'true', limit: 50 }),
    ]);
    const manage = can(...ROLES.MANAGEMENT);
    const dlg = openDialog({
      title: html`${medicineName(m)} ${m.requires_prescription ? html`<span class="rx-tag">Rx</span>` : ''}`,
      description: `${medicineSub(m)} · ${m.category_name}`,
      size: 'wide',
      body: html`
        ${!m.is_active ? html`<div class="callout callout-warn">${icon('archive')}<span>Archived. It no longer appears at the POS.</span></div>` : ''}
        <div class="stats">
          <div class="stat"><span class="label">Price</span><span class="value">${money(m.price)}</span><span class="meta">per ${m.unit}</span></div>
          <div class="stat"><span class="label">Sellable here</span><span class="value">${num(m.stock_on_hand)}</span><span class="meta">Reorder at ${num(m.reorder_level)}</span></div>
          <div class="stat"><span class="label">Nearest expiry</span><span class="value" style="font-size:1rem;padding-top:.5rem">${expiryPill(m.nearest_expiry, m.days_to_expiry)}</span><span class="meta">${m.barcode ? `Barcode ${m.barcode}` : 'No barcode'}</span></div>
        </div>
        <section>
          <h3>Stock by branch</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>Branch</th><th class="num">Sellable</th><th class="num">Expired, awaiting write-off</th></tr></thead>
            <tbody>${m.branches.map((b) => html`<tr><td>${b.branch_name}</td><td class="num">${num(b.sellable)}</td><td class="num">${num(b.expired_qty)}</td></tr>`)}</tbody></table></div>
        </section>
        <section>
          <h3>Batches on hand</h3>
          ${batches.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>Batch</th><th>Branch</th><th>Expiry</th><th class="num">On hand</th><th>Supplier</th></tr></thead>
            <tbody>${batches.map((b) => html`<tr><td class="mono">${b.batch_no}</td><td>${b.branch_name}</td><td>${expiryPill(b.expiry_date, b.days_to_expiry)}</td><td class="num">${num(b.qty_on_hand)}</td><td>${b.supplier_name ?? html`<span class="subtle">Unknown</span>`}</td></tr>`)}</tbody></table></div>`
            : html`<p class="small subtle">No stock on hand. Receive a batch to start selling this medicine.</p>`}
        </section>`,
      footer: html`
        ${manage && m.is_active ? html`<button class="btn btn-ghost" type="button" data-archive>${icon('archive')}Archive</button>` : ''}
        <span class="spacer"></span>
        ${can('admin', 'manager', 'pharmacist') && m.is_active ? html`<button class="btn" type="button" data-receive>${icon('package-plus')}Receive stock</button>` : ''}
        ${manage ? html`<button class="btn" type="button" data-edit>${icon('pencil')}Edit</button>` : ''}
        <button class="btn btn-primary" type="button" data-close>Done</button>`,
    });
    dlg.el.querySelector('[data-edit]')?.addEventListener('click', () => { dlg.close(); editMedicine(m, list); });
    dlg.el.querySelector('[data-receive]')?.addEventListener('click', () => { dlg.close(); receiveStockDialog({ medicine: m, onSaved: () => list.reload() }); });
    dlg.el.querySelector('[data-archive]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Archive ${medicineName(m)}?`,
        message: 'It will disappear from the POS and from stock alerts. Existing sales and batches are kept, and you can restore it later by editing it.',
        confirmLabel: 'Archive medicine',
        danger: true,
        onConfirm: () => api.del(`/medicines/${m.medicine_id}`),
      });
      if (ok) { dlg.close(); toast('Medicine archived.'); list.reload(); dataChanged(); }
    });
  } catch (err) {
    toastError(err);
  }
}

async function categoriesDialog(list) {
  const dlg = openDialog({
    title: 'Categories',
    description: 'Group medicines for filtering and reports.',
    body: html`<form id="cat-form" class="row" novalidate>
        <div class="field" style="flex:1"><label class="sr-only" for="cat-name">New category</label>
          <input class="input" id="cat-name" name="name" placeholder="New category name" maxlength="60" required><span class="error"></span></div>
        <button class="btn btn-primary" type="submit">${icon('plus')}Add</button>
      </form>
      <div id="cat-list"></div>`,
    footer: html`<button class="btn btn-primary" type="button" data-close>Done</button>`,
    onClose: () => list.reload(),
  });
  const box = dlg.el.querySelector('#cat-list');
  const drawList = async () => {
    await loadCategories();
    draw(box, html`<div class="panel">${categories.map((c) => html`<div class="list-row">
      <span>${c.name} <span class="subtle small">· ${c.medicine_count} medicine(s)</span></span>
      <span class="row">
        <button class="btn btn-ghost btn-sm" type="button" data-rename="${c.category_id}" data-name="${c.name}">Rename</button>
        <button class="btn btn-ghost btn-sm" type="button" data-delete="${c.category_id}" ${c.medicine_count > 0 ? html`disabled title="Move its medicines to another category first"` : ''}>Delete</button>
      </span></div>`)}</div>`);
  };
  const form = dlg.el.querySelector('#cat-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const err = form.querySelector('.error');
    err.textContent = '';
    if (!input.value.trim()) { err.textContent = 'Enter a name.'; return; }
    try {
      await api.post('/categories', { name: input.value });
      input.value = '';
      toast('Category added.');
      drawList();
    } catch (ex) { err.textContent = ex.message; input.setAttribute('aria-invalid', 'true'); }
  });
  on(box, 'click', '[data-rename]', (_e, btn) => formDialog({
    title: `Rename ${btn.dataset.name}`,
    size: 'narrow',
    defs: [{ name: 'name', label: 'Category name', required: true, span: true, attrs: { maxlength: 60 } }],
    values: { name: btn.dataset.name },
    endpoint: '/categories',
    id: btn.dataset.rename,
    submitLabel: 'Rename',
    onSaved: drawList,
  }));
  on(box, 'click', '[data-delete]', async (_e, btn) => {
    try { await api.del(`/categories/${btn.dataset.delete}`); toast('Category deleted.'); drawList(); } catch (ex) { toastError(ex); }
  });
  drawList();
}

