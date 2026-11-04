import { api } from '../api.js';
import { html, render as draw, $, on } from '../dom.js';
import { icon } from '../icons.js';
import { num, dateTime, date, statusPill, medicineName, expiryPill } from '../format.js';
import { session } from '../session.js';
import { createList } from '../ui/list.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { handleForm } from '../ui/form.js';
import { fields } from '../ui/fields.js';
import { combobox } from '../ui/combobox.js';
import { toast, toastError } from '../ui/toast.js';
import { pageHeader, branchFilter, branches, searchMedicines, medicineOption, dataChanged } from './shared.js';

const mine = (branchId) => session.user.role === 'admin' || session.user.branch_id === branchId;

export async function render(container, { id }) {
  draw(container, html`
    ${pageHeader('Transfers', 'Move stock between branches. The sending branch dispatches; the receiving branch confirms arrival.',
      html`<button class="btn btn-primary" type="button" id="new-transfer">${icon('plus')}New transfer</button>`)}
    <section class="panel" id="transfer-list"></section>`);

  const list = createList($('#transfer-list', container), {
    endpoint: '/transfers',
    caption: 'Transfers',
    toolbar: html`
      <label class="sr-only" for="t-status">Status</label>
      <select class="select" id="t-status" name="status" data-filter><option value="">Any status</option>
        <option value="requested">Requested</option><option value="in_transit">In transit</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select>
      ${await branchFilter()}`,
    columns: [
      { label: 'No.', render: (t) => html`<span class="mono">#${t.transfer_id}</span>` },
      { label: 'Route', render: (t) => html`<span class="primary-cell">${t.from_branch_name} → ${t.to_branch_name}</span>${t.notes ? html`<span class="secondary-line">${t.notes}</span>` : ''}` },
      { label: 'Items', num: true, render: (t) => html`${num(t.total_units)} units<span class="secondary-line">${t.medicine_count} medicine(s)</span>` },
      { label: 'Requested', render: (t) => html`${date(t.created_at)}<span class="secondary-line">${t.requested_by_name}</span>` },
      { label: 'Status', render: (t) => statusPill(t.status) },
      { label: 'Next step', render: (t) => nextStep(t) },
    ],
    rowKey: (t) => t.transfer_id,
    onRowClick: (tid) => openTransfer(tid, list),
    empty: { icon: 'arrow-left-right', title: 'No transfers yet', message: 'Request stock from another branch when you run low, or send near-expiry stock where it sells faster.' },
  });

  $('#new-transfer', container).addEventListener('click', () => newTransfer(list));
  if (id) openTransfer(id, list);
}

function nextStep(t) {
  if (t.status === 'requested') return mine(t.from_branch_id) ? html`<strong>Dispatch</strong>` : html`<span class="subtle">Waiting for ${t.from_branch_name}</span>`;
  if (t.status === 'in_transit') return mine(t.to_branch_id) ? html`<strong>Confirm receipt</strong>` : html`<span class="subtle">Waiting for ${t.to_branch_name}</span>`;
  return html`<span class="subtle">None</span>`;
}

async function openTransfer(tid, list) {
  try {
    const { data: t } = await api.get(`/transfers/${tid}`);
    const dlg = openDialog({
      title: html`Transfer #${t.transfer_id} ${statusPill(t.status)}`,
      description: `${t.from_branch_name} → ${t.to_branch_name}`,
      size: 'wide',
      body: html`
        <dl class="details">
          <dt>Requested</dt><dd>${dateTime(t.created_at)} by ${t.requested_by_name}</dd>
          ${t.dispatched_at ? html`<dt>Dispatched</dt><dd>${dateTime(t.dispatched_at)} by ${t.dispatched_by_name}</dd>` : ''}
          ${t.received_at ? html`<dt>Received</dt><dd>${dateTime(t.received_at)} by ${t.received_by_name}</dd>` : ''}
          ${t.notes ? html`<dt>Notes</dt><dd>${t.notes}</dd>` : ''}
        </dl>
        ${t.status === 'requested' ? html`<p class="small muted">Batches are picked when the sending branch dispatches, earliest expiry first.</p>` : ''}
        <div class="table-wrap"><table class="table"><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th class="num">Quantity</th></tr></thead>
          <tbody>${t.items.map((i) => html`<tr><td><span class="primary-cell">${i.generic_name} ${i.strength}</span><span class="secondary-line">${i.brand}</span></td>
            <td class="mono">${i.batch_no ?? html`<span class="subtle">Picked at dispatch</span>`}</td>
            <td>${i.expiry_date ? expiryPill(i.expiry_date, Math.round((new Date(`${i.expiry_date}T00:00:00`) - new Date()) / 86400000)) : ''}</td>
            <td class="num">${num(i.quantity)}</td></tr>`)}</tbody></table></div>`,
      footer: html`
        ${['requested', 'in_transit'].includes(t.status) ? html`<button class="btn btn-ghost" type="button" data-cancel>${icon('ban')}Cancel transfer</button>` : ''}
        <span class="spacer"></span>
        <button class="btn" type="button" data-close>Close</button>
        ${t.status === 'requested' && mine(t.from_branch_id) ? html`<button class="btn btn-primary" type="button" data-act="dispatch">${icon('truck')}Dispatch</button>` : ''}
        ${t.status === 'in_transit' && mine(t.to_branch_id) ? html`<button class="btn btn-primary" type="button" data-act="receive">${icon('check')}Confirm receipt</button>` : ''}`,
    });
    const done = (msg) => { dlg.close(); toast(msg); dataChanged(); list.reload(); };
    on(dlg.el, 'click', '[data-act]', async (_e, btn) => {
      btn.setAttribute('aria-busy', 'true');
      try { done((await api.post(`/transfers/${t.transfer_id}/${btn.dataset.act}`)).message); } catch (err) {
        btn.removeAttribute('aria-busy');
        toastError(err.errors ? Object.assign(err, { message: `${err.message} Reduce the quantities or cancel the request.` }) : err);
      }
    });
    dlg.el.querySelector('[data-cancel]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Cancel transfer #${t.transfer_id}?`,
        message: t.status === 'in_transit' ? 'The shipped units go back into the sending branch\'s batches.' : 'The request will be closed. No stock has moved yet.',
        confirmLabel: 'Cancel transfer', danger: true,
        onConfirm: () => api.post(`/transfers/${t.transfer_id}/cancel`),
      });
      if (ok) done('Transfer cancelled.');
    });
  } catch (err) {
    toastError(err);
  }
}

async function newTransfer(list) {
  const all = await branches();
  const own = session.user.branch_id;
  const items = [];
  const dlg = openDialog({
    title: 'New transfer',
    description: own ? 'Request stock for your branch, or send stock to another branch.' : 'Move stock between any two branches.',
    size: 'wide',
    body: html`<form id="transfer-form" class="form-grid" novalidate>
      <div class="form-error span-2" role="alert" hidden></div>
      ${fields([
        { name: 'from_branch_id', label: 'From (sending branch)', type: 'select', required: true, placeholder: 'Choose a branch', options: all.map((b) => [b.branch_id, b.name]), value: own && all.length === 2 ? all.find((b) => b.branch_id !== own).branch_id : '' },
        { name: 'to_branch_id', label: 'To (receiving branch)', type: 'select', required: true, placeholder: 'Choose a branch', options: all.map((b) => [b.branch_id, b.name]), value: own ?? '' },
        { name: 'notes', label: 'Notes', span: true, attrs: { maxlength: 255 }, placeholder: 'Why this transfer is needed' },
      ])}
      <div class="field span-2">
        <span class="label">Medicines<span class="req" aria-hidden="true">*</span></span>
        <div class="items-editor" id="t-items"></div>
        <div class="combo"><input class="input" id="t-add" placeholder="Add a medicine" aria-label="Add a medicine"></div>
        <span class="hint">Stock shown is the sending branch's sellable stock.</span>
        <span class="error" data-error-for="items"></span>
      </div>
    </form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="transfer-form">Request transfer</button>`,
  });
  const form = dlg.el.querySelector('form');
  const box = form.querySelector('#t-items');
  const drawItems = () => draw(box, items.length ? items.map((it, i) => html`<div class="item-row" style="grid-template-columns:minmax(0,1fr) 7rem auto">
    <div class="selected-chip"><span class="truncate"><strong>${medicineName(it.medicine)}</strong> <span class="subtle small">${it.medicine.brand} · ${num(it.medicine.stock_on_hand)} available</span></span></div>
    <input class="input" type="number" min="1" step="1" value="${it.quantity}" data-q="${i}" aria-label="Quantity">
    <button class="btn btn-ghost btn-icon" type="button" data-rm="${i}" aria-label="Remove">${icon('trash-2')}</button></div>`) : html`<p class="small subtle">No medicines added yet.</p>`);
  on(box, 'input', '[data-q]', (_e, el) => { items[Number(el.dataset.q)].quantity = Number(el.value); });
  on(box, 'click', '[data-rm]', (_e, el) => { items.splice(Number(el.dataset.rm), 1); drawItems(); });
  drawItems();
  const fromSel = form.querySelector('[name="from_branch_id"]');
  combobox(form.querySelector('#t-add'), {
    search: (q) => searchMedicines(q, { branch: fromSel.value || undefined }),
    option: medicineOption,
    minChars: 1,
    onSelect: (m) => {
      form.querySelector('#t-add').value = '';
      if (items.some((x) => x.medicine.medicine_id === m.medicine_id)) return;
      items.push({ medicine: m, quantity: 1 });
      drawItems();
    },
  });
  handleForm(form, async (data) => {
    const res = await api.post('/transfers', { ...data, items: items.map((it) => ({ medicine_id: it.medicine.medicine_id, quantity: it.quantity })) });
    dlg.close();
    toast(res.message);
    dataChanged();
    list.reload();
  }, (data) => {
    const errors = {};
    if (!items.length) errors.items = 'Add at least one medicine.';
    if (items.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1)) errors.items = 'Quantities must be whole numbers of at least 1.';
    if (data.from_branch_id && data.from_branch_id === data.to_branch_id) errors.to_branch_id = 'Choose a different branch.';
    return errors;
  });
}
