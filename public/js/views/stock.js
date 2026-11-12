// Medicines & Stock: one page for the catalogue and everything on the shelf.
// Replaces the old Medicines, Inventory (batches, alerts, reorder, stock ledger) and Transfers pages.
import { api } from '../api.js';
import { html, render as draw, $, on } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, expiryPill, date, dateTime, medicineName, medicineSub, MOVEMENT_LABELS, daysFromToday } from '../format.js';
import { can, ROLES, session, isOwner } from '../session.js';
import { createList } from '../ui/list.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { formDialog } from '../ui/formDialog.js';
import { handleForm } from '../ui/form.js';
import { fields } from '../ui/fields.js';
import { combobox } from '../ui/combobox.js';
import { toast, toastError } from '../ui/toast.js';
import { pageHeader, branchFilter, branches, searchMedicines, medicineOption, medicineCell, dataChanged } from './shared.js';

const FILTERS = [
  ['', 'All'],
  ['low', 'Running low'],
  ['expiring', 'Expiring soon'],
  ['expired', 'Expired'],
  ['out', 'Out of stock'],
];

const isManager = () => can(...ROLES.MANAGEMENT);
const handlesStock = () => can(...ROLES.DISPENSING);

/** One plain-language status per medicine. The most urgent problem wins. */
function stockBadge(m) {
  if (!m.is_active) return html`<span class="pill">Archived</span>`;
  if (m.expired_qty > 0) return html`<span class="pill pill-danger">Has expired stock</span>`;
  if (m.stock_status === 'out') return html`<span class="pill pill-danger">Out of stock</span>`;
  if (m.stock_status === 'low') return html`<span class="pill pill-warn">Running low</span>`;
  if (m.expiring_qty > 0) return html`<span class="pill pill-warn">Expiring soon</span>`;
  return html`<span class="pill pill-ok">OK</span>`;
}

export async function render(container, { id, query }) {
  const startFilter = FILTERS.some(([v]) => v === query?.stock) ? query.stock : '';
  draw(container, html`
    ${pageHeader('Medicines & Stock', 'Everything on your shelves. Click a medicine to see its stock by expiry date, receive a delivery, or remove expired stock.',
      html`${isManager() ? html`<button class="btn" type="button" id="add-medicine">${icon('plus')}Add medicine</button>` : ''}
        ${handlesStock() ? html`<button class="btn btn-primary" type="button" id="receive">${icon('package-plus')}Receive delivery</button>` : ''}`)}
    <section class="panel" id="stock-list"></section>`);

  // Suggested order quantities only matter when looking at what is running low.
  let reorder = null;
  const list = createList($('#stock-list', container), {
    endpoint: '/medicines',
    caption: 'Medicines and stock',
    params: { stock: startFilter, sort: 'generic_name' },
    toolbar: html`
      <div class="segmented" role="radiogroup" aria-label="Show">
        ${FILTERS.map(([v, l]) => html`<label><input type="radio" name="stock" value="${v}" data-filter ${v === startFilter ? 'checked' : ''}><span>${l}</span></label>`)}
      </div>
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="med-q">Search medicines</label>
        <input class="input" id="med-q" type="search" name="q" data-filter placeholder="Search by name, brand, or barcode"></div>
      ${await branchFilter()}
      ${isManager() ? html`<label class="check"><input type="checkbox" name="status" value="all" data-filter> Show archived</label>` : ''}`,
    columns: (state) => [
      { label: 'Medicine', sortKey: 'generic_name', render: medicineCell },
      { label: 'Price', num: true, render: (m) => money(m.price) },
      { label: 'In stock', num: true, sortKey: 'stock_on_hand', render: (m) => html`${num(m.stock_on_hand)} <span class="subtle small">${m.unit}</span>` },
      { label: 'Next to expire', sortKey: 'nearest_expiry', render: (m) => expiryPill(m.nearest_expiry, m.days_to_expiry) },
      ...(state.stock === 'low' ? [{ label: 'Suggested order', num: true, render: (m) => (m.suggested_qty ? html`<strong>${num(m.suggested_qty)}</strong>` : '') }] : []),
      { label: 'Status', render: stockBadge },
    ],
    transform: async (rows, state) => {
      if (state.stock !== 'low' || !handlesStock()) return rows;
      reorder ??= (await api.get('/inventory/reorder', { branch: state.branch || undefined })).data;
      const byId = new Map(reorder.map((r) => [r.medicine_id, r.suggested_qty]));
      return rows.map((m) => ({ ...m, suggested_qty: byId.get(m.medicine_id) }));
    },
    onLoad: () => { reorder = null; },
    rowKey: (m) => m.medicine_id,
    onRowClick: (mid) => openMedicine(mid, list),
    empty: { icon: 'pill', title: 'No medicines yet', message: 'Add a medicine, then receive a delivery to put it on the shelf.' },
  });

  $('#add-medicine', container)?.addEventListener('click', () => editMedicine(null, list));
  $('#receive', container)?.addEventListener('click', () => receiveStockDialog({ onSaved: () => list.reload() }));
  if (id) openMedicine(id, list);
}

/* ---------- Medicine detail ---------- */

async function openMedicine(medicineId, list) {
  try {
    const owner = isOwner();
    const [{ data: m }, { data: lots }, history] = await Promise.all([
      api.get(`/medicines/${medicineId}`),
      api.get('/batches', { medicine: medicineId, in_stock: 'true', sort: 'expiry_date', limit: 50 }),
      handlesStock() ? api.get('/inventory/movements', { medicine: medicineId, limit: 10 }).then((r) => r.data) : Promise.resolve(null),
    ]);
    const canSend = isManager() && m.is_active && m.branches.length > 1;
    const dlg = openDialog({
      title: html`${medicineName(m)} ${m.requires_prescription ? html`<span class="rx-tag" title="Needs a prescription">Rx</span>` : ''}`,
      description: `${medicineSub(m)} · ${m.category}`,
      size: 'wide',
      body: html`
        ${!m.is_active ? html`<div class="callout callout-warn">${icon('archive')}<span>Archived. It no longer appears at Sell.</span></div>` : ''}
        ${m.requires_prescription ? html`<div class="callout">${icon('info')}<span>Needs a prescription. It can only be sold with a prescription a pharmacist has checked.</span></div>` : ''}
        <div class="stats">
          <div class="stat"><span class="label">Price</span><span class="value">${money(m.price)}</span><span class="meta">per ${m.unit}</span></div>
          <div class="stat"><span class="label">${owner ? 'In stock, all branches' : 'In stock'}</span><span class="value">${num(m.stock_on_hand)}</span><span class="meta">Running low at ${num(m.reorder_level)} or fewer</span></div>
          <div class="stat"><span class="label">Next to expire</span><span class="value" style="font-size:1rem;padding-top:.5rem">${expiryPill(m.nearest_expiry, m.days_to_expiry)}</span><span class="meta">${m.barcode ? `Barcode ${m.barcode}` : 'No barcode'}</span></div>
        </div>
        ${owner ? html`<section>
          <h3>Stock at each branch</h3>
          <div class="table-wrap"><table class="table"><thead><tr><th>Branch</th><th class="num">Can be sold</th><th class="num">Expired (remove these)</th></tr></thead>
            <tbody>${m.branches.map((b) => html`<tr><td>${b.branch_name}</td><td class="num">${num(b.sellable)}</td><td class="num">${b.expired_qty ? html`<span style="color:var(--danger-text)">${num(b.expired_qty)}</span>` : '0'}</td></tr>`)}</tbody></table></div>
        </section>` : ''}
        <section>
          <h3>Stock by expiry date</h3>
          <p class="small subtle">Sell always uses the one that expires first.</p>
          ${lots.length ? html`<div class="alert-list">${lots.map((b) => html`<div class="alert-item">
              <span><strong>${num(b.qty_on_hand)} ${m.unit}${b.qty_on_hand === 1 ? '' : 's'}</strong> · expires ${date(b.expiry_date)}
                <span class="secondary-line small subtle">Lot <span class="mono">${b.batch_no}</span>${owner ? ` · ${b.branch_name}` : ''}${b.supplier_name ? ` · from ${b.supplier_name}` : ''}</span></span>
              <span class="row">${expiryPill(b.expiry_date, b.days_to_expiry)}
                ${handlesStock() ? html`<button class="btn btn-sm ${b.expiry_status === 'expired' ? 'btn-danger' : ''}" type="button" data-remove="${b.batch_id}">${b.expiry_status === 'expired' ? 'Remove expired' : 'Remove'}</button>` : ''}
                ${isManager() && b.expiry_status !== 'expired' ? html`<button class="btn btn-ghost btn-sm" type="button" data-fix="${b.batch_id}" aria-label="Fix lot details">${icon('pencil', 'icon-sm')}</button>` : ''}</span>
            </div>`)}</div>`
            : html`<p class="small subtle">Nothing on the shelf. Receive a delivery to start selling this medicine.</p>`}
        </section>
        ${history ? html`<section>
          <h3>Recent stock history</h3>
          ${history.length ? html`<div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>What happened</th><th class="num">Change</th><th>By</th></tr></thead>
            <tbody>${history.map((h) => html`<tr>
              <td class="nowrap">${dateTime(h.created_at)}</td>
              <td>${MOVEMENT_LABELS[h.type]}${h.reason ? html`<span class="secondary-line">${h.reason}</span>` : ''}${h.ref_type === 'sale' ? html`<span class="secondary-line"><a href="#/sales/${h.ref_id}">View sale</a></span>` : ''}</td>
              <td class="num"><strong style="color:${h.qty_change > 0 ? 'var(--success-text)' : 'var(--text)'}">${h.qty_change > 0 ? '+' : '−'}${num(Math.abs(h.qty_change))}</strong></td>
              <td>${h.user_name}${owner ? html`<span class="secondary-line">${h.branch_name}</span>` : ''}</td></tr>`)}</tbody></table></div>`
            : html`<p class="small subtle">No stock changes yet.</p>`}
        </section>` : ''}`,
      footer: html`
        ${isManager() && m.is_active ? html`<button class="btn btn-ghost" type="button" data-archive>${icon('archive')}Archive</button>` : ''}
        ${isManager() ? html`<button class="btn btn-ghost" type="button" data-edit>${icon('pencil')}Edit details</button>` : ''}
        <span class="spacer"></span>
        ${canSend ? html`<button class="btn" type="button" data-send>${icon('arrow-left-right')}Send to another branch</button>` : ''}
        ${handlesStock() && m.is_active ? html`<button class="btn btn-primary" type="button" data-receive>${icon('package-plus')}Receive delivery</button>` : html`<button class="btn btn-primary" type="button" data-close>Done</button>`}`,
    });
    const reopen = () => { list.reload(); dataChanged(); openMedicine(medicineId, list); };
    on(dlg.el, 'click', 'a[href^="#/"]', () => dlg.close());
    on(dlg.el, 'click', '[data-remove]', (_e, b) => { dlg.close(); removeStockDialog(lots.find((x) => x.batch_id === Number(b.dataset.remove)), m, reopen); });
    on(dlg.el, 'click', '[data-fix]', (_e, b) => { dlg.close(); editLot(lots.find((x) => x.batch_id === Number(b.dataset.fix)), reopen); });
    dlg.el.querySelector('[data-edit]')?.addEventListener('click', () => { dlg.close(); editMedicine(m, list); });
    dlg.el.querySelector('[data-receive]')?.addEventListener('click', () => { dlg.close(); receiveStockDialog({ medicine: m, onSaved: reopen }); });
    dlg.el.querySelector('[data-send]')?.addEventListener('click', () => { dlg.close(); sendStockDialog(m, reopen); });
    dlg.el.querySelector('[data-archive]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Archive ${medicineName(m)}?`,
        message: 'It disappears from Sell and from stock warnings. Past sales and stock records are kept. You can bring it back later from Edit details.',
        confirmLabel: 'Archive medicine', danger: true,
        onConfirm: () => api.del(`/medicines/${m.medicine_id}`),
      });
      if (ok) { dlg.close(); toast('Medicine archived.'); list.reload(); dataChanged(); }
    });
  } catch (err) {
    toastError(err);
  }
}

/* ---------- Add / edit a medicine ---------- */

async function editMedicine(m, list) {
  const categories = (await api.get('/categories')).data;
  formDialog({
    title: m ? `Edit ${medicineName(m)}` : 'Add medicine',
    description: m ? 'Change the price, the warning level, or other details.' : 'A new medicine starts with no stock. Receive a delivery to make it sellable.',
    defs: [
      { name: 'generic_name', label: 'Generic name', required: true, attrs: { maxlength: 120 }, placeholder: 'Paracetamol' },
      { name: 'brand', label: 'Brand', required: true, attrs: { maxlength: 120 }, hint: 'Write "Generic" if it has no brand' },
      { name: 'strength', label: 'Strength', required: true, attrs: { maxlength: 40 }, placeholder: '500 mg' },
      { name: 'dosage_form', label: 'Form', required: true, type: 'select', placeholder: 'Choose',
        options: ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Drops', 'Inhaler', 'Nebule', 'Injection', 'Ointment', 'Cream', 'Solution', 'Sachet'].map((f) => [f, f]) },
      { name: 'category', label: 'Category', required: true, attrs: { maxlength: 60 }, placeholder: 'Analgesics', suggestions: categories.map((c) => c.name), hint: 'Pick one from the list or type a new one' },
      { name: 'unit', label: 'Sold per', required: true, attrs: { maxlength: 20 }, placeholder: 'tablet', hint: 'What "1" means when selling: tablet, bottle, sachet…' },
      { name: 'price', label: 'Selling price (with VAT)', type: 'number', required: true, attrs: { min: 0.01, step: 0.01, inputmode: 'decimal' } },
      { name: 'reorder_level', label: 'Warn me when stock is at or below', type: 'number', required: true, value: 20, attrs: { min: 0, step: 1 } },
      { name: 'barcode', label: 'Barcode (optional)', attrs: { maxlength: 32, inputmode: 'numeric' } },
      { name: 'requires_prescription', label: 'Needs a prescription (Rx)', type: 'checkbox', hint: 'Can only be sold with a prescription a pharmacist has checked' },
      ...(m ? [{ name: 'is_active', label: 'Available for sale (untick to archive)', type: 'checkbox', span: true }] : []),
    ],
    values: m ?? {},
    endpoint: '/medicines',
    id: m?.medicine_id,
    size: 'wide',
    submitLabel: m ? 'Save changes' : 'Add medicine',
    prepare: (d) => ({ ...d, barcode: d.barcode || null, is_active: m ? d.is_active : true }),
    onSaved: () => { list.reload(); dataChanged(); },
  });
}

/* ---------- Receive a delivery ---------- */

/** Records a delivery: the units, their expiry date and lot number. Supplier and cost are optional. */
export async function receiveStockDialog({ medicine = null, onSaved } = {}) {
  const owner = isOwner();
  const [suppliers, branchList] = await Promise.all([api.get('/suppliers').then((r) => r.data), owner ? branches() : []]);
  let chosen = medicine;
  const label = (m) => `${medicineName(m)} (${m.brand})`;
  const dlg = openDialog({
    title: 'Receive delivery',
    description: session.user.branch_name ? `Adds stock to ${session.user.branch_name}. Copy the details from the box.` : 'Adds stock to the branch you choose. Copy the details from the box.',
    size: 'wide',
    body: html`<form id="receive-form" class="form-grid" novalidate>
      <div class="form-error span-2" role="alert" hidden></div>
      <div class="field span-2">
        <label for="rcv-medicine">Medicine<span class="req" aria-hidden="true">*</span></label>
        <div class="combo"><input class="input" id="rcv-medicine" placeholder="Type a name, brand, or scan the barcode" value="${medicine ? label(medicine) : ''}" aria-describedby="rcv-medicine-error"></div>
        <input type="hidden" name="medicine_id" value="${medicine?.medicine_id ?? ''}">
        <span class="error" id="rcv-medicine-error" data-error-for="medicine_id"></span>
      </div>
      ${fields([
        ...(owner ? [{ name: 'branch_id', label: 'Branch', type: 'select', required: true, placeholder: 'Choose a branch', options: branchList.map((b) => [b.branch_id, b.name]), span: true }] : []),
        { name: 'quantity', label: 'How many?', type: 'number', required: true, attrs: { min: 1, step: 1 }, hint: medicine ? `Count in ${medicine.unit}s` : 'Count in the unit you sell' },
        { name: 'expiry_date', label: 'Expiry date', type: 'date', required: true, attrs: { min: daysFromToday(1) }, hint: 'As printed on the box' },
        { name: 'batch_no', label: 'Lot number', required: true, attrs: { maxlength: 40 }, hint: 'Printed as "Lot" or "Batch" on the box', span: true },
      ])}
      <details class="span-2">
        <summary class="small muted" style="cursor:pointer">More details (optional): supplier and cost</summary>
        <div class="form-grid" style="margin-top:var(--space-3)">
          ${fields([
            { name: 'supplier', label: 'Supplier', attrs: { maxlength: 120 }, suggestions: suppliers.map((s) => s.name), placeholder: 'Who delivered it' },
            { name: 'cost_price', label: 'Cost per unit', type: 'number', attrs: { min: 0, step: 0.01 }, hint: 'Used for profit and stock value' },
          ])}
        </div>
      </details>
    </form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="receive-form">Add to stock</button>`,
  });
  const form = dlg.el.querySelector('form');
  const input = form.querySelector('#rcv-medicine');
  combobox(input, {
    search: (q) => searchMedicines(q),
    option: medicineOption,
    minChars: 1,
    onSelect: (m) => {
      chosen = m;
      input.value = label(m);
      form.querySelector('[name="medicine_id"]').value = m.medicine_id;
      form.querySelector('#f-quantity-hint').textContent = `Count in ${m.unit}s`;
      form.querySelector('#f-quantity').focus();
    },
  });
  input.addEventListener('input', () => { if (chosen && input.value !== label(chosen)) { chosen = null; form.querySelector('[name="medicine_id"]').value = ''; } });
  if (!medicine) input.focus(); else form.querySelector('#f-quantity').focus();

  handleForm(form, async (data) => {
    const res = await api.post('/batches', { ...data, supplier: data.supplier || null, branch_id: data.branch_id || null, cost_price: data.cost_price === '' ? 0 : data.cost_price });
    dlg.close();
    toast(`${res.message} ${medicineName(res.data)}, lot ${res.data.batch_no}.`);
    dataChanged();
    onSaved?.(res.data);
  }, (data) => (data.medicine_id ? {} : { medicine_id: 'Type and choose a medicine.' }));
}

/* ---------- Remove stock / correct a count ---------- */

const REASONS = [
  ['expired', 'Expired', 'Dispose of it following your FDA disposal procedure.'],
  ['damaged', 'Damaged or unusable', 'Broken, contaminated, or otherwise cannot be sold.'],
  ['correction', 'Shelf count is different', 'The number on the shelf does not match the system.'],
];

function removeStockDialog(lot, m, onDone) {
  const expired = lot.expiry_status === 'expired';
  const reasons = REASONS.filter(([k]) => k !== 'correction' || can(...ROLES.MANAGEMENT));
  const dlg = openDialog({
    title: `Remove stock: ${medicineName(m)}`,
    description: `Lot ${lot.batch_no} · ${num(lot.qty_on_hand)} on hand · expires ${date(lot.expiry_date)}`,
    body: html`<form id="remove-form" class="form-grid" novalidate>
      <div class="form-error span-2" role="alert" hidden></div>
      <fieldset class="field span-2" style="border:0;padding:0;margin:0">
        <legend class="label">Why?<span class="req" aria-hidden="true">*</span></legend>
        <div class="stack" style="gap:var(--space-2)">
          ${reasons.map(([k, l, hint], i) => html`<label class="check"><input type="radio" name="why" value="${k}" ${(expired ? k === 'expired' : i === 1) ? 'checked' : ''}>
            <span><strong>${l}</strong><span class="secondary-line">${hint}</span></span></label>`)}
        </div>
      </fieldset>
      <div class="field span-2" data-for="remove">
        <label for="rm-qty">How many to remove?<span class="req" aria-hidden="true">*</span></label>
        <input class="input" id="rm-qty" name="qty" type="number" min="1" max="${lot.qty_on_hand}" step="1" value="${expired ? lot.qty_on_hand : ''}">
        <span class="hint">Up to ${num(lot.qty_on_hand)}</span><span class="error" data-error-for="qty_change"></span>
      </div>
      <div class="field span-2" data-for="correction" hidden>
        <label for="rm-count">How many are actually on the shelf?<span class="req" aria-hidden="true">*</span></label>
        <input class="input" id="rm-count" name="count" type="number" min="0" step="1" value="${lot.qty_on_hand}">
        <span class="hint">The system has ${num(lot.qty_on_hand)}. Enter what you counted.</span><span class="error" data-error-for="count"></span>
      </div>
      <div class="field span-2"><label for="rm-note">Note (optional)</label>
        <input class="input" id="rm-note" name="note" maxlength="200" placeholder="${expired ? 'Disposed of per FDA procedure' : 'What happened?'}"></div>
    </form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="remove-form">Save</button>`,
  });
  const form = dlg.el.querySelector('form');
  const sync = () => {
    const why = form.querySelector('[name="why"]:checked').value;
    form.querySelector('[data-for="remove"]').hidden = why === 'correction';
    form.querySelector('[data-for="correction"]').hidden = why !== 'correction';
  };
  form.addEventListener('change', sync);
  sync();

  handleForm(form, async (data) => {
    const reasonLabel = REASONS.find(([k]) => k === data.why)[1];
    const reason = [reasonLabel, data.note].filter(Boolean).join(': ');
    let body;
    if (data.why === 'correction') {
      const diff = Number(data.count) - lot.qty_on_hand;
      if (data.count === '' || !Number.isInteger(Number(data.count)) || Number(data.count) < 0) throw Object.assign(new Error('Enter the number you counted.'), { errors: { count: 'Enter a whole number, 0 or more.' } });
      if (diff === 0) throw Object.assign(new Error('The count already matches.'), { errors: { count: 'This matches the system. Nothing to change.' } });
      body = { type: 'adjust', qty_change: diff, reason };
    } else {
      const qty = Number(data.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > lot.qty_on_hand) throw Object.assign(new Error('Check the quantity.'), { errors: { qty_change: `Enter a number from 1 to ${lot.qty_on_hand}.` } });
      body = { type: 'write_off', qty_change: -qty, reason };
    }
    const res = await api.post(`/batches/${lot.batch_id}/adjust`, body);
    dlg.close();
    toast(`${res.message} ${num(res.data.qty_on_hand)} left in this lot.`);
    onDone?.();
  });
}

/* ---------- Fix lot details (managers) ---------- */

async function editLot(lot, onDone) {
  const suppliers = (await api.get('/suppliers')).data;
  formDialog({
    title: 'Fix lot details',
    description: 'Correct a typo in the lot number, expiry date or cost. To change the quantity, use Remove instead. Once units from a lot are sold, its expiry date can only be moved earlier.',
    defs: [
      { name: 'batch_no', label: 'Lot number', required: true, attrs: { maxlength: 40 } },
      { name: 'expiry_date', label: 'Expiry date', type: 'date', required: true, attrs: { min: daysFromToday(1) } },
      { name: 'cost_price', label: 'Cost per unit', type: 'number', required: true, attrs: { min: 0, step: 0.01 } },
      { name: 'supplier', label: 'Supplier', attrs: { maxlength: 120 }, suggestions: suppliers.map((s) => s.name) },
    ],
    values: { ...lot, supplier: lot.supplier ?? '' },
    endpoint: '/batches',
    id: lot.batch_id,
    submitLabel: 'Save changes',
    prepare: (d) => ({ ...d, supplier: d.supplier || null }),
    onSaved: onDone,
  });
}

/* ---------- Send stock to another branch (managers) ---------- */

async function sendStockDialog(m, onDone) {
  const owner = isOwner();
  const list = await branches();
  const mine = session.user.branch_id;
  const dlg = openDialog({
    title: `Send ${medicineName(m)} to another branch`,
    description: 'The stock leaves one branch and arrives at the other right away. Expiry dates and lot numbers go with it.',
    body: html`<form id="send-form" class="form-grid" novalidate>
      <div class="form-error span-2" role="alert" hidden></div>
      ${fields([
        ...(owner ? [{ name: 'from_branch_id', label: 'From', type: 'select', required: true, placeholder: 'Choose a branch', options: list.map((b) => [b.branch_id, b.name]) }] : []),
        { name: 'to_branch_id', label: 'To', type: 'select', required: true, placeholder: 'Choose a branch', options: list.filter((b) => b.branch_id !== mine).map((b) => [b.branch_id, b.name]), span: !owner },
        { name: 'quantity', label: 'How many?', type: 'number', required: true, attrs: { min: 1, step: 1 }, span: true,
          hint: owner ? m.branches.map((b) => `${b.branch_name}: ${num(b.sellable)}`).join(' · ') : `${num(m.branches.find((b) => b.branch_id === mine)?.sellable ?? 0)} ${m.unit}s can be sent from your branch` },
        { name: 'notes', label: 'Note (optional)', span: true, attrs: { maxlength: 255 }, placeholder: 'North Branch ran out' },
      ])}
    </form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="send-form">${icon('arrow-left-right')}Send stock</button>`,
  });
  handleForm(dlg.el.querySelector('form'), async (data) => {
    const res = await api.post('/transfers', {
      from_branch_id: data.from_branch_id || null, to_branch_id: data.to_branch_id, notes: data.notes || null,
      items: [{ medicine_id: m.medicine_id, quantity: data.quantity }],
    });
    dlg.close();
    toast(res.message);
    onDone?.();
  }, (data) => (data.from_branch_id && data.from_branch_id === data.to_branch_id ? { to_branch_id: 'Choose a different branch.' } : {}));
}

