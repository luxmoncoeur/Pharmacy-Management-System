import { api } from '../api.js';
import { html, render as draw, $, on } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, expiryPill, dateTime, date, medicineName, MOVEMENT_LABELS, today, daysFromToday } from '../format.js';
import { can, ROLES, session } from '../session.js';
import { createList } from '../ui/list.js';
import { openDialog } from '../ui/dialog.js';
import { handleForm } from '../ui/form.js';
import { fields } from '../ui/fields.js';
import { combobox } from '../ui/combobox.js';
import { toast, toastError } from '../ui/toast.js';
import { pageHeader, branchFilter, branches, searchMedicines, medicineOption, dataChanged } from './shared.js';

const TABS = [
  ['batches', 'Batches'],
  ['alerts', 'Alerts'],
  ['reorder', 'Reorder'],
  ['movements', 'Stock ledger', ROLES.MANAGEMENT],
];

export async function render(container, { query }) {
  const tabs = TABS.filter(([, , roles]) => !roles || can(...roles));
  let active = tabs.some(([k]) => k === query?.tab) ? query.tab : 'batches';

  draw(container, html`
    ${pageHeader('Inventory', 'Every unit lives in a batch with a known expiry. Sales always draw the earliest-expiring batch first.',
      html`<button class="btn btn-primary" type="button" id="receive">${icon('package-plus')}Receive stock</button>`)}
    <section class="panel">
      <div class="tabs" role="tablist" aria-label="Inventory views">
        ${tabs.map(([k, l]) => html`<button type="button" role="tab" id="tab-${k}" aria-controls="tabpanel" aria-selected="${k === active}" tabindex="${k === active ? 0 : -1}" data-tab="${k}">${l}<span class="count" data-count="${k}"></span></button>`)}
      </div>
      <div id="tabpanel" role="tabpanel" aria-labelledby="tab-${active}"></div>
    </section>`);

  const panel = $('#tabpanel', container);
  const show = async (tab) => {
    active = tab;
    container.querySelectorAll('[data-tab]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); b.tabIndex = b.dataset.tab === tab ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `tab-${tab}`);
    history.replaceState(null, '', `#/inventory?tab=${tab}`);
    if (tab === 'batches') await batchesTab(panel);
    if (tab === 'alerts') await alertsTab(panel, container);
    if (tab === 'reorder') await reorderTab(panel);
    if (tab === 'movements') await movementsTab(panel);
  };
  on(container, 'click', '[data-tab]', (_e, b) => show(b.dataset.tab));
  on(container, 'keydown', '[role="tab"]', (e, b) => {
    const all = [...container.querySelectorAll('[role="tab"]')];
    const i = all.indexOf(b);
    const next = e.key === 'ArrowRight' ? all[(i + 1) % all.length] : e.key === 'ArrowLeft' ? all[(i - 1 + all.length) % all.length] : null;
    if (next) { e.preventDefault(); next.focus(); show(next.dataset.tab); }
  });
  $('#receive', container).addEventListener('click', () => receiveStockDialog({ onSaved: () => show(active) }));

  api.get('/inventory/alerts').then(({ data }) => {
    const n = data.expired.length + data.near_expiry.length + data.low_stock.length;
    const el = container.querySelector('[data-count="alerts"]');
    if (el && n) el.textContent = n;
  }).catch(() => {});

  await show(active);
}

async function batchesTab(panel) {
  const list = createList(panel, {
    endpoint: '/batches',
    caption: 'Batches',
    params: { in_stock: 'true', sort: 'expiry_date' },
    toolbar: html`
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="b-q">Search batches</label>
        <input class="input" id="b-q" type="search" name="q" data-filter placeholder="Medicine or batch number"></div>
      <label class="sr-only" for="b-exp">Expiry</label>
      <select class="select" id="b-exp" name="expiry" data-filter><option value="">Any expiry</option><option value="expired">Expired</option><option value="near">Expiring within 90 days</option><option value="ok">More than 90 days</option></select>
      <label class="check"><input type="checkbox" name="in_stock" value="true" data-filter checked> Only batches with stock</label>
      ${await branchFilter()}`,
    columns: [
      { label: 'Medicine', sortKey: 'generic_name', render: (b) => html`<span class="primary-cell">${b.generic_name} ${b.strength}</span><span class="secondary-line">${b.brand} · ${b.dosage_form}</span>` },
      { label: 'Batch', render: (b) => html`<span class="mono">${b.batch_no}</span><span class="secondary-line">${b.supplier_name ?? 'Supplier not recorded'}</span>` },
      ...(session.user.role === 'admin' ? [{ label: 'Branch', key: 'branch_name' }] : []),
      { label: 'Expiry', sortKey: 'expiry_date', render: (b) => expiryPill(b.expiry_date, b.days_to_expiry) },
      { label: 'On hand', num: true, sortKey: 'qty_on_hand', render: (b) => html`${num(b.qty_on_hand)}<span class="secondary-line">of ${num(b.qty_received)} received</span>` },
      { label: 'Received', sortKey: 'received_at', render: (b) => date(b.received_at) },
    ],
    rowKey: (b) => b.batch_id,
    onRowClick: (id) => openBatch(id, () => list.reload()),
    empty: { icon: 'package', title: 'No batches yet', message: 'Receive stock from a supplier to create the first batch.' },
  });
}

async function alertsTab(panel, container) {
  draw(panel, html`<div class="state"><span class="skeleton" style="width:50%"></span></div>`);
  try {
    const branch = container.querySelector('#filter-branch')?.value;
    const { data } = await api.get('/inventory/alerts', { branch });
    const section = (title, desc, rows, renderRow, emptyText) => html`
      <section aria-label="${title}">
        <div class="panel-header"><div><h2>${title} <span class="subtle">(${rows.length})</span></h2><p class="small subtle">${desc}</p></div></div>
        ${rows.length ? html`<div class="alert-list">${rows.map(renderRow)}</div>` : html`<div class="state"><p>${emptyText}</p></div>`}
      </section>`;
    const batchRow = (b) => html`<div class="alert-item">
      <span><strong>${b.generic_name} ${b.strength}</strong> <span class="subtle">${b.brand}</span>
        <span class="secondary-line small subtle">Batch <span class="mono">${b.batch_no}</span> · ${num(b.qty_on_hand)} units · ${b.branch_name}</span></span>
      <span class="row">${expiryPill(b.expiry_date, b.days_to_expiry)}
        ${can(...ROLES.MANAGEMENT) ? html`<button class="btn btn-sm" type="button" data-batch="${b.batch_id}">${b.expiry_status === 'expired' ? 'Write off' : 'Open'}</button>` : ''}</span>
    </div>`;
    draw(panel, html`
      ${section('Expired stock', 'Cannot be sold. Write it off and dispose of it following your FDA disposal procedure.', data.expired, batchRow, 'No expired stock on hand.')}
      ${section(`Expiring within ${data.near_expiry_days} days`, 'Sell these first (the POS already does), return them to the supplier, or transfer them to a busier branch.', data.near_expiry, batchRow, 'Nothing expires soon.')}
      ${section('Low or out of stock', 'At or below the reorder level. See the Reorder tab for suggested quantities.', data.low_stock, (m) => html`<div class="alert-item">
        <span><strong>${m.generic_name} ${m.strength}</strong> <span class="subtle">${m.brand}</span>
          ${session.user.role === 'admin' ? html`<span class="secondary-line small subtle">${m.branch_name}</span>` : ''}</span>
        <span class="row"><span class="small muted">Reorder at ${num(m.reorder_level)}</span>
          <span class="pill ${m.stock_on_hand ? 'pill-warn' : 'pill-danger'}">${m.stock_on_hand ? `${num(m.stock_on_hand)} left` : 'Out of stock'}</span></span>
      </div>`, 'Every medicine is above its reorder level.')}`);
    on(panel, 'click', '[data-batch]', (_e, b) => openBatch(b.dataset.batch, () => alertsTab(panel, container)));
  } catch (err) {
    draw(panel, html`<div class="state state-error">${icon('circle-alert')}<p>${err.message}</p></div>`);
  }
}

async function reorderTab(panel) {
  draw(panel, html`<div class="state"><span class="skeleton" style="width:50%"></span></div>`);
  try {
    const { data } = await api.get('/inventory/reorder');
    if (!data.length) {
      draw(panel, html`<div class="state">${icon('circle-check')}<h3>Nothing to reorder</h3><p>Every medicine is above its reorder level.</p></div>`);
      return;
    }
    const csv = ['Medicine,Brand,Strength,On hand,Sold last 30 days,Reorder level,Suggested order,Last supplier',
      ...data.map((r) => [r.generic_name, r.brand, r.strength, r.stock_on_hand, r.sold_30d, r.reorder_level, r.suggested_qty, r.last_supplier ?? ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    draw(panel, html`
      <div class="toolbar"><p class="small muted grow">Suggested order covers 30 days of recent sales or twice the reorder level, whichever is larger.</p>
        <a class="btn btn-sm" download="reorder-list-${today()}.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}">${icon('download', 'icon-sm')}Download CSV</a></div>
      <div class="table-wrap"><table class="table"><caption class="sr-only">Reorder suggestions</caption>
        <thead><tr><th>Medicine</th><th class="num">On hand</th><th class="num">Sold, 30 days</th><th class="num">Reorder level</th><th class="num">Suggested order</th><th>Last supplier</th></tr></thead>
        <tbody>${data.map((r) => html`<tr>
          <td><span class="primary-cell">${r.generic_name} ${r.strength}</span><span class="secondary-line">${r.brand}</span></td>
          <td class="num">${num(r.stock_on_hand)}</td><td class="num">${num(r.sold_30d)}</td><td class="num">${num(r.reorder_level)}</td>
          <td class="num"><strong>${num(r.suggested_qty)}</strong></td><td>${r.last_supplier ?? html`<span class="subtle">None yet</span>`}</td></tr>`)}</tbody>
      </table></div>`);
  } catch (err) {
    draw(panel, html`<div class="state state-error">${icon('circle-alert')}<p>${err.message}</p></div>`);
  }
}

async function movementsTab(panel) {
  createList(panel, {
    endpoint: '/inventory/movements',
    caption: 'Stock ledger',
    limit: 50,
    params: { from: daysFromToday(-13), to: today() },
    toolbar: html`
      <label class="sr-only" for="m-type">Movement type</label>
      <select class="select" id="m-type" name="type" data-filter><option value="">All movements</option>
        ${Object.entries(MOVEMENT_LABELS).map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select>
      <label class="sr-only" for="m-from">From</label><input class="input" id="m-from" type="date" name="from" data-filter value="${daysFromToday(-13)}" max="${today()}">
      <label class="sr-only" for="m-to">To</label><input class="input" id="m-to" type="date" name="to" data-filter value="${today()}" max="${today()}">
      ${await branchFilter()}`,
    columns: [
      { label: 'When', render: (m) => dateTime(m.created_at) },
      { label: 'Medicine', render: (m) => html`<span class="primary-cell">${m.generic_name} ${m.strength}</span><span class="secondary-line">Batch <span class="mono">${m.batch_no}</span></span>` },
      { label: 'Movement', render: (m) => html`${MOVEMENT_LABELS[m.type]}${m.reason ? html`<span class="secondary-line">${m.reason}</span>` : ''}${m.ref_type === 'sale' ? html`<span class="secondary-line"><a href="#/sales/${m.ref_id}">Sale #${m.ref_id}</a></span>` : ''}` },
      { label: 'Change', num: true, render: (m) => html`<strong style="color:${m.qty_change > 0 ? 'var(--success-text)' : 'var(--text)'}">${m.qty_change > 0 ? '+' : '−'}${num(Math.abs(m.qty_change))}</strong>` },
      { label: 'By', render: (m) => html`${m.user_name}${session.user.role === 'admin' ? html`<span class="secondary-line">${m.branch_name}</span>` : ''}` },
    ],
    empty: { icon: 'history', title: 'No stock movements', message: 'Receipts, sales, adjustments and transfers are recorded here.' },
  });
}

async function openBatch(batchId, onChange) {
  try {
    const { data: b } = await api.get(`/batches/${batchId}`);
    const manage = can(...ROLES.MANAGEMENT);
    const dlg = openDialog({
      title: `${b.generic_name} ${b.strength}`,
      description: `${b.brand} · batch ${b.batch_no} · ${b.branch_name}`,
      body: html`
        <dl class="details">
          <dt>Expiry</dt><dd>${expiryPill(b.expiry_date, b.days_to_expiry)} ${date(b.expiry_date)}</dd>
          <dt>On hand</dt><dd>${num(b.qty_on_hand)} of ${num(b.qty_received)} received</dd>
          <dt>Cost price</dt><dd>${money(b.cost_price)} per ${b.unit} · ${money(b.cost_price * b.qty_on_hand)} on hand</dd>
          <dt>Supplier</dt><dd>${b.supplier_name ?? 'Not recorded'}</dd>
          <dt>Received</dt><dd>${dateTime(b.received_at)}</dd>
        </dl>
        ${manage ? html`<form id="adjust-form" class="form-grid" novalidate>
          <h3 class="span-2">Adjust stock</h3>
          <div class="form-error span-2" role="alert" hidden></div>
          ${fields([
            { name: 'type', label: 'Type', type: 'select', required: true, value: b.expiry_status === 'expired' ? 'write_off' : 'adjust',
              options: [['adjust', 'Correction (recount, damage, found stock)'], ['write_off', 'Write off (expired or unusable)']] },
            { name: 'qty_change', label: 'Quantity change', type: 'number', required: true,
              value: b.expiry_status === 'expired' ? -b.qty_on_hand : '', attrs: { step: 1, min: -b.qty_on_hand }, hint: 'Negative removes stock, positive adds it' },
            { name: 'reason', label: 'Reason', required: true, span: true, attrs: { maxlength: 255 }, placeholder: b.expiry_status === 'expired' ? 'Expired, disposed of per FDA procedure' : 'Physical count was 3 lower' },
          ])}
        </form>` : ''}`,
      footer: html`
        ${manage ? html`<button class="btn" type="button" data-edit>${icon('pencil')}Correct details</button>` : ''}
        <span class="spacer"></span>
        <button class="btn" type="button" data-close>Close</button>
        ${manage ? html`<button class="btn btn-primary" type="submit" form="adjust-form">Record adjustment</button>` : ''}`,
    });
    const form = dlg.el.querySelector('#adjust-form');
    if (form) {
      handleForm(form, async (data) => {
        if (data.type === 'write_off' && data.qty_change > 0) throw Object.assign(new Error('A write-off removes stock.'), { errors: { qty_change: 'Use a negative number for a write-off.' } });
        const res = await api.post(`/batches/${batchId}/adjust`, data);
        dlg.close();
        toast(`${res.message} ${num(res.data.qty_on_hand)} now on hand.`);
        dataChanged();
        onChange?.();
      });
    }
    dlg.el.querySelector('[data-edit]')?.addEventListener('click', () => { dlg.close(); editBatch(b, onChange); });
  } catch (err) {
    toastError(err);
  }
}

async function editBatch(b, onChange) {
  const suppliers = (await api.get('/suppliers')).data;
  const dlg = openDialog({
    title: 'Correct batch details',
    description: 'Fix a mistyped batch number, expiry date, or cost. Quantities change only through adjustments.',
    body: html`<form id="batch-edit" class="form-grid" novalidate><div class="form-error span-2" role="alert" hidden></div>
      ${fields([
        { name: 'batch_no', label: 'Batch number', required: true, attrs: { maxlength: 40 } },
        { name: 'expiry_date', label: 'Expiry date', type: 'date', required: true },
        { name: 'cost_price', label: 'Cost price', type: 'number', required: true, attrs: { min: 0, step: 0.01 } },
        { name: 'supplier_id', label: 'Supplier', type: 'select', placeholder: 'Not recorded', options: suppliers.map((s) => [s.supplier_id, s.name]) },
      ], b)}</form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="batch-edit">Save changes</button>`,
  });
  handleForm(dlg.el.querySelector('form'), async (data) => {
    const res = await api.patch(`/batches/${b.batch_id}`, { ...data, supplier_id: data.supplier_id || null });
    dlg.close();
    toast(res.message);
    dataChanged();
    onChange?.();
  });
}

/** Records a delivery: creates a batch with its expiry and adds the units to this branch. */
export async function receiveStockDialog({ medicine = null, onSaved } = {}) {
  const [suppliers, branchList] = await Promise.all([api.get('/suppliers').then((r) => r.data), session.user.role === 'admin' ? branches() : []]);
  let chosen = medicine;
  const dlg = openDialog({
    title: 'Receive stock',
    description: session.user.branch_name ? `Adds a new batch to ${session.user.branch_name}.` : 'Adds a new batch to the selected branch.',
    size: 'wide',
    body: html`<form id="receive-form" class="form-grid" novalidate>
      <div class="form-error span-2" role="alert" hidden></div>
      <div class="field span-2">
        <label for="rcv-medicine">Medicine<span class="req" aria-hidden="true">*</span></label>
        <div class="combo"><input class="input" id="rcv-medicine" placeholder="Search by name, brand or barcode" value="${medicine ? `${medicineName(medicine)} (${medicine.brand})` : ''}" aria-describedby="rcv-medicine-error"></div>
        <input type="hidden" name="medicine_id" value="${medicine?.medicine_id ?? ''}">
        <span class="error" id="rcv-medicine-error" data-error-for="medicine_id"></span>
      </div>
      ${fields([
        ...(session.user.role === 'admin' ? [{ name: 'branch_id', label: 'Branch', type: 'select', required: true, placeholder: 'Choose a branch', options: branchList.map((b) => [b.branch_id, b.name]) }] : []),
        { name: 'supplier_id', label: 'Supplier', type: 'select', placeholder: 'Not recorded', options: suppliers.map((s) => [s.supplier_id, s.name]) },
        { name: 'batch_no', label: 'Batch / lot number', required: true, attrs: { maxlength: 40 }, hint: 'As printed on the box' },
        { name: 'expiry_date', label: 'Expiry date', type: 'date', required: true, attrs: { min: daysFromToday(1) } },
        { name: 'quantity', label: 'Quantity received', type: 'number', required: true, attrs: { min: 1, step: 1 }, hint: medicine ? `In ${medicine.unit}s` : 'In selling units' },
        { name: 'cost_price', label: 'Cost per unit', type: 'number', required: true, attrs: { min: 0, step: 0.01 }, hint: 'Used for stock value and profit reports' },
      ])}
    </form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="receive-form">Receive stock</button>`,
  });
  const form = dlg.el.querySelector('form');
  const input = form.querySelector('#rcv-medicine');
  combobox(input, {
    search: (q) => searchMedicines(q),
    option: medicineOption,
    minChars: 1,
    onSelect: (m) => {
      chosen = m;
      input.value = `${medicineName(m)} (${m.brand})`;
      form.querySelector('[name="medicine_id"]').value = m.medicine_id;
      form.querySelector('#f-batch_no').focus();
    },
  });
  input.addEventListener('input', () => { if (chosen && input.value !== `${medicineName(chosen)} (${chosen.brand})`) { chosen = null; form.querySelector('[name="medicine_id"]').value = ''; } });
  if (!medicine) input.focus();

  handleForm(form, async (data) => {
    const res = await api.post('/batches', { ...data, supplier_id: data.supplier_id || null, branch_id: data.branch_id || null });
    dlg.close();
    toast(`${res.message} ${medicineName(res.data)}, batch ${res.data.batch_no}.`);
    dataChanged();
    onSaved?.(res.data);
  }, (data) => (data.medicine_id ? {} : { medicine_id: 'Search and choose a medicine.' }));
}
