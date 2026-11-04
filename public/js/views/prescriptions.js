import { api } from '../api.js';
import { html, render as draw, $, on } from '../dom.js';
import { icon } from '../icons.js';
import { num, date, dateTime, statusPill, medicineName, today, money } from '../format.js';
import { canSell, session, isOwner } from '../session.js';
import { createList } from '../ui/list.js';
import { openDialog, confirmDialog } from '../ui/dialog.js';
import { handleForm } from '../ui/form.js';
import { fields } from '../ui/fields.js';
import { combobox } from '../ui/combobox.js';
import { toast, toastError } from '../ui/toast.js';
import { formDialog } from '../ui/formDialog.js';
import { pageHeader, branchFilter, branches, searchMedicines, medicineOption, searchCustomers, customerOption, dataChanged } from './shared.js';
import { openPrescriptionRecord } from './rxPrint.js';

const STATUSES = [['pending', 'To check'], ['dispensable', 'Ready to give out'], ['', 'All']];

export async function render(container, { id, query }) {
  const status = STATUSES.some(([v]) => v === query?.status) ? query.status : '';
  draw(container, html`
    ${pageHeader('Prescriptions', 'Three steps: 1. Record what the paper prescription says. 2. A pharmacist checks it. 3. Give out the medicine at Sell.',
      html`<button class="btn btn-primary" type="button" id="add-rx">${icon('plus')}Record a prescription</button>`)}
    <section class="panel" id="rx-list"></section>`);

  const list = createList($('#rx-list', container), {
    endpoint: '/prescriptions',
    caption: 'Prescriptions',
    params: { status },
    toolbar: html`
      <div class="segmented" role="radiogroup" aria-label="Show">
        ${STATUSES.map(([v, l]) => html`<label><input type="radio" name="status" value="${v}" data-filter ${v === status ? 'checked' : ''}><span>${l}</span></label>`)}
      </div>
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="rx-q">Search prescriptions</label>
        <input class="input" id="rx-q" type="search" name="q" data-filter placeholder="Patient, doctor, or prescription number"></div>
      ${await branchFilter()}`,
    columns: [
      { label: 'No.', render: (p) => html`<span class="mono">#${p.prescription_id}</span>` },
      { label: 'Patient', render: (p) => html`<span class="primary-cell">${p.customer_name}</span><span class="secondary-line">${p.item_count} medicine(s)</span>` },
      { label: 'Doctor', render: (p) => html`${p.doctor_name}<span class="secondary-line mono">${p.doctor_license_no}</span>` },
      { label: 'Date written', sortKey: 'date_issued', render: (p) => date(p.date_issued) },
      { label: 'Checked by', render: (p) => p.pharmacist_name ?? html`<span class="subtle">Not yet</span>` },
      { label: 'Status', sortKey: 'status', render: (p) => statusPill(p.status) },
    ],
    rowKey: (p) => p.prescription_id,
    onRowClick: (pid) => openPrescription(pid, list),
    empty: { icon: 'clipboard-list', title: 'Nothing here', message: 'Record a prescription when a patient hands one over. A pharmacist checks it before the medicine can be given out.' },
  });

  $('#add-rx', container).addEventListener('click', () => editPrescription(null, list));
  if (id) openPrescription(id, list);
  if (query?.new) { history.replaceState(null, '', '#/prescriptions'); editPrescription(null, list); }
}

async function openPrescription(rxId, list) {
  try {
    const { data: rx } = await api.get(`/prescriptions/${rxId}`);
    const isPharmacist = session.user.role === 'pharmacist';
    const pending = rx.status === 'pending';
    const dispensable = ['verified', 'partially_dispensed'].includes(rx.status);
    const daysOld = Math.floor((Date.now() - new Date(`${rx.date_issued}T00:00:00`).getTime()) / 86400000);
    const dlg = openDialog({
      title: html`Prescription #${rx.prescription_id} ${statusPill(rx.status)}`,
      description: `${rx.customer_name} · ${rx.branch_name}`,
      size: 'wide',
      body: html`
        ${pending && isPharmacist ? html`<div class="callout">${icon('info')}<span><strong>Before you verify, check the paper prescription:</strong>
          <ul style="margin:.35rem 0 0 1.1rem;padding:0"><li>The doctor's name, signature and PRC license number are there</li><li>The patient's name matches</li><li>The date is recent and the medicines and amounts below match</li></ul></span></div>` : ''}
        ${pending && !isPharmacist ? html`<div class="callout callout-warn">${icon('clock')}<span>Waiting for a pharmacist to check it. It cannot be given out until then.</span></div>` : ''}
        ${pending && daysOld > 180 ? html`<div class="callout callout-warn">${icon('triangle-alert')}<span>Issued ${daysOld} days ago. Confirm it is still valid before verifying.</span></div>` : ''}
        ${rx.status === 'rejected' ? html`<div class="callout callout-danger">${icon('ban')}<span>Rejected: ${rx.rejection_reason}</span></div>` : ''}
        <dl class="details">
          <dt>Patient</dt><dd><a href="#/customers/${rx.customer_id}">${rx.customer_name}</a></dd>
          <dt>Doctor</dt><dd>${rx.doctor_name} · PRC ${rx.doctor_license_no}</dd>
          <dt>Date written</dt><dd>${date(rx.date_issued)}</dd>
          <dt>Recorded</dt><dd>${dateTime(rx.created_at)} by ${rx.created_by_name}</dd>
          ${rx.reviewed_at ? html`<dt>Checked</dt><dd>${dateTime(rx.reviewed_at)} by ${rx.pharmacist_name}${rx.pharmacist_license_no ? ` (PRC ${rx.pharmacist_license_no})` : ''}</dd>` : ''}
          ${rx.notes ? html`<dt>Notes</dt><dd>${rx.notes}</dd>` : ''}
        </dl>
        <div class="table-wrap"><table class="table"><caption class="sr-only">Prescribed medicines</caption>
          <thead><tr><th>Medicine</th><th>Instructions</th><th class="num">Prescribed</th><th class="num">Given out</th><th class="num">In stock</th></tr></thead>
          <tbody>${rx.items.map((i) => html`<tr>
            <td><span class="primary-cell">${i.generic_name} ${i.strength}</span> ${i.requires_prescription ? html`<span class="rx-tag">Rx</span>` : ''}<span class="secondary-line">${i.brand} · ${money(i.price)} per ${i.unit}</span></td>
            <td>${i.instructions ?? html`<span class="subtle">None</span>`}</td>
            <td class="num">${num(i.quantity)}</td>
            <td class="num">${num(i.qty_dispensed)}</td>
            <td class="num">${i.remaining > 0 && i.stock_on_hand < i.remaining ? html`<span style="color:var(--warning-text)">${num(i.stock_on_hand)}</span>` : num(i.stock_on_hand)}</td>
          </tr>`)}</tbody></table></div>`,
      footer: html`
        ${pending ? html`<button class="btn btn-ghost" type="button" data-delete>${icon('trash-2')}Delete</button>
          <button class="btn btn-ghost" type="button" data-edit>${icon('pencil')}Edit</button>` : ''}
        <button class="btn btn-ghost" type="button" data-record>${icon('printer')}Print record</button>
        <span class="spacer"></span>
        ${pending && isPharmacist ? html`<button class="btn btn-lg" type="button" data-reject>${icon('ban')}Reject</button>
          <button class="btn btn-primary btn-lg" type="button" data-verify>${icon('check')}Verify</button>` : ''}
        ${dispensable && canSell() ? html`<a class="btn btn-primary" href="#/pos?rx=${rx.prescription_id}">${icon('shopping-cart')}Give out at Sell</a>` : ''}
        ${!(pending && isPharmacist) && !(dispensable && canSell()) ? html`<button class="btn btn-primary" type="button" data-close>Done</button>` : ''}`,
    });
    const after = (message) => { dlg.close(); toast(message); dataChanged(); list.reload(); };
    on(dlg.el, 'click', 'a[href^="#/"]', () => dlg.close());
    dlg.el.querySelector('[data-verify]')?.addEventListener('click', async (e) => {
      e.currentTarget.setAttribute('aria-busy', 'true');
      try { after((await api.post(`/prescriptions/${rx.prescription_id}/verify`)).message); } catch (err) { toastError(err); e.currentTarget?.removeAttribute('aria-busy'); }
    });
    dlg.el.querySelector('[data-reject]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Reject prescription #${rx.prescription_id}?`,
        message: 'The patient will need a new or corrected prescription. Staff at the counter will see your reason.',
        confirmLabel: 'Reject prescription', danger: true, reasonLabel: 'Reason',
        onConfirm: (reason) => api.post(`/prescriptions/${rx.prescription_id}/reject`, { reason }),
      });
      if (ok) after('Prescription rejected.');
    });
    dlg.el.querySelector('[data-delete]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete prescription #${rx.prescription_id}?`,
        message: 'Use this only for a prescription recorded by mistake. Reviewed prescriptions are kept permanently.',
        confirmLabel: 'Delete', danger: true,
        onConfirm: () => api.del(`/prescriptions/${rx.prescription_id}`),
      });
      if (ok) after('Prescription deleted.');
    });
    dlg.el.querySelector('[data-edit]')?.addEventListener('click', () => { dlg.close(); editPrescription(rx, list); });
    dlg.el.querySelector('[data-record]').addEventListener('click', () => { dlg.close(); openPrescriptionRecord(rx); });
  } catch (err) {
    toastError(err);
  }
}

async function editPrescription(rx, list) {
  const branchList = isOwner() && !rx ? await branches() : [];
  const pharmacist = session.user.role === 'pharmacist';
  let verifyOnSave = false;
  let customer = rx ? { customer_id: rx.customer_id, full_name: rx.customer_name } : null;
  const items = rx ? rx.items.map((i) => ({ medicine: i, quantity: i.quantity, instructions: i.instructions ?? '' })) : [];

  const dlg = openDialog({
    title: rx ? `Edit prescription #${rx.prescription_id}` : 'Record a prescription',
    description: 'Copy the details exactly as written on the paper prescription.',
    size: 'wide',
    body: html`<form id="rx-form" class="form-grid" novalidate>
      <div class="form-error span-2" role="alert" hidden></div>
      <div class="field span-2">
        <label for="rx-customer">Patient<span class="req" aria-hidden="true">*</span></label>
        <div class="row" style="flex-wrap:nowrap">
          <div class="combo" style="flex:1"><input class="input" id="rx-customer" placeholder="Type the patient's name or phone" value="${customer?.full_name ?? ''}" aria-describedby="rx-customer-error"></div>
          <button class="btn" type="button" data-new-patient>${icon('user-plus')}New patient</button>
        </div>
        <input type="hidden" name="customer_id" value="${customer?.customer_id ?? ''}">
        <span class="error" id="rx-customer-error" data-error-for="customer_id"></span>
      </div>
      ${fields([
        ...(branchList.length ? [{ name: 'branch_id', label: 'Branch', type: 'select', required: true, placeholder: 'Choose a branch', options: branchList.map((b) => [b.branch_id, b.name]) }] : []),
        { name: 'doctor_name', label: 'Doctor\'s name', required: true, attrs: { maxlength: 120 }, placeholder: 'Dr. Juana Dela Cruz' },
        { name: 'doctor_license_no', label: 'Doctor\'s PRC license no.', required: true, attrs: { maxlength: 30 } },
        { name: 'date_issued', label: 'Date written', type: 'date', required: true, value: today(), attrs: { max: today() } },
        { name: 'notes', label: 'Notes', type: 'textarea', span: true, attrs: { maxlength: 500, rows: 2 } },
      ], rx ?? {})}
      <div class="field span-2">
        <span class="label" id="rx-items-label">Medicines<span class="req" aria-hidden="true">*</span></span>
        <div class="items-editor" id="rx-items" aria-labelledby="rx-items-label"></div>
        <div class="combo"><input class="input" id="rx-add-med" placeholder="Add a medicine: type its name or brand" aria-label="Add a medicine"></div>
        <span class="error" data-error-for="items"></span>
      </div>
    </form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button>
      ${pharmacist && !rx ? html`<button class="btn" type="submit" form="rx-form">Save for later</button>
        <button class="btn btn-primary" type="submit" form="rx-form" data-verify-save>${icon('check')}Save and verify</button>`
        : html`<button class="btn btn-primary" type="submit" form="rx-form">${rx ? 'Save changes' : 'Save'}</button>`}`,
  });
  const form = dlg.el.querySelector('form');
  const itemsEl = form.querySelector('#rx-items');

  const drawItems = () => draw(itemsEl, items.length ? items.map((it, i) => html`<div class="item-row">
      <div class="selected-chip"><span class="truncate"><strong>${medicineName(it.medicine)}</strong> <span class="subtle small">${it.medicine.brand}</span></span></div>
      <input class="input" type="number" min="1" step="1" value="${it.quantity}" data-item-qty="${i}" aria-label="Quantity for ${medicineName(it.medicine)}" required>
      <input class="input instr" value="${it.instructions}" data-item-instr="${i}" maxlength="255" placeholder="Instructions, e.g. 1 tablet every 8 hours" aria-label="Instructions for ${medicineName(it.medicine)}">
      <button class="btn btn-ghost btn-icon" type="button" data-item-remove="${i}" aria-label="Remove ${medicineName(it.medicine)}">${icon('trash-2')}</button>
    </div>`) : html`<p class="small subtle">No medicines added yet.</p>`);
  on(itemsEl, 'input', '[data-item-qty]', (_e, el) => { items[Number(el.dataset.itemQty)].quantity = Number(el.value); });
  on(itemsEl, 'input', '[data-item-instr]', (_e, el) => { items[Number(el.dataset.itemInstr)].instructions = el.value; });
  on(itemsEl, 'click', '[data-item-remove]', (_e, el) => { items.splice(Number(el.dataset.itemRemove), 1); drawItems(); });
  drawItems();

  // Pharmacists who have the paper in hand can verify while saving; the click sets the flag before submit runs.
  dlg.el.querySelectorAll('[type="submit"]').forEach((b) => b.addEventListener('click', () => { verifyOnSave = b.hasAttribute('data-verify-save'); }));

  const custInput = form.querySelector('#rx-customer');
  combobox(custInput, {
    search: searchCustomers, option: customerOption, minChars: 1,
    onSelect: (c) => { customer = c; custInput.value = c.full_name; form.querySelector('[name="customer_id"]').value = c.customer_id; },
  });
  custInput.addEventListener('input', () => { if (customer && custInput.value !== customer.full_name) { customer = null; form.querySelector('[name="customer_id"]').value = ''; } });
  const setCustomer = (c) => { customer = c; custInput.value = c.full_name; form.querySelector('[name="customer_id"]').value = c.customer_id; };
  form.querySelector('[data-new-patient]').addEventListener('click', () => {
    const [firstname = '', ...rest] = custInput.value.trim().split(/\s+/);
    formDialog({
      title: 'New patient',
      description: 'Just the basics. You can add a Senior Citizen or PWD ID later on the Customers page.',
      size: 'narrow',
      defs: [
        { name: 'firstname', label: 'First name', required: true, attrs: { maxlength: 60 } },
        { name: 'lastname', label: 'Last name', required: true, attrs: { maxlength: 60 } },
        { name: 'phone', label: 'Phone (optional)', type: 'tel', span: true, attrs: { maxlength: 20 } },
      ],
      values: customer ? {} : { firstname, lastname: rest.join(' ') },
      endpoint: '/customers',
      submitLabel: 'Add patient',
      prepare: (d) => ({ ...d, discount_id_type: 'none' }),
      onSaved: setCustomer,
    });
  });

  const medInput = form.querySelector('#rx-add-med');
  combobox(medInput, {
    search: (q) => searchMedicines(q), option: medicineOption, minChars: 1,
    onSelect: (m) => {
      medInput.value = '';
      if (items.some((it) => it.medicine.medicine_id === m.medicine_id)) { toast('That medicine is already on this prescription.', { type: 'info' }); return; }
      items.push({ medicine: m, quantity: 1, instructions: '' });
      drawItems();
      itemsEl.querySelector(`[data-item-qty="${items.length - 1}"]`).select();
    },
  });

  const validate = (data) => {
    const errors = {};
    if (!data.customer_id) errors.customer_id = 'Search and choose the patient.';
    if (!items.length) errors.items = 'Add at least one medicine.';
    if (items.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1)) errors.items = 'Each quantity must be a whole number of at least 1.';
    return errors;
  };
  handleForm(form, async (data) => {
    const body = {
      customer_id: Number(data.customer_id),
      doctor_name: data.doctor_name,
      doctor_license_no: data.doctor_license_no,
      date_issued: data.date_issued,
      notes: data.notes || null,
      branch_id: data.branch_id || null,
      verify: !rx && verifyOnSave,
      items: items.map((it) => ({ medicine_id: it.medicine.medicine_id, quantity: it.quantity, instructions: it.instructions || null })),
    };
    const res = rx ? await api.put(`/prescriptions/${rx.prescription_id}`, body) : await api.post('/prescriptions', body);
    dlg.close();
    toast(res.message);
    dataChanged();
    list.reload();
  }, validate);
  if (!rx) custInput.focus();
}
