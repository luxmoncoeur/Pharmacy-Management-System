import { api } from '../api.js';
import { html, render, $, on, debounce } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, medicineName, medicineSub, expiryPill, date, DISCOUNT_LABELS } from '../format.js';
import { computeTotals } from '../pricing.js';
import { openDialog } from '../ui/dialog.js';
import { toast, toastError } from '../ui/toast.js';
import { combobox } from '../ui/combobox.js';
import { handleForm, showErrors, withBusy } from '../ui/form.js';
import { fields } from '../ui/fields.js';
import { session } from '../session.js';
import { searchCustomers, customerOption, dataChanged } from './shared.js';
import { openReceipt } from './receipt.js';

const state = {
  cart: [], // { medicine, quantity }
  customer: null,
  prescription: null,
  discount: 'none',
  errors: {}, // index -> message from the server
  results: [],
};

const reset = () => Object.assign(state, { cart: [], customer: null, prescription: null, discount: 'none', errors: {} });

export async function render_(container, { query }) {
  if (!session.user.branch_id) {
    render(container, html`<div class="panel state">${icon('building-2')}<h3>The POS needs a branch</h3>
      <p>Sales are recorded against a branch till. Sign in with a branch account to sell.</p></div>`);
    return undefined;
  }

  render(container, html`
    <div class="pos">
      <section class="panel" aria-labelledby="catalog-title">
        <div class="panel-header">
          <h2 id="catalog-title">Find a medicine</h2>
          <span class="small subtle"><span class="kbd">/</span> search · <span class="kbd">F9</span> charge</span>
        </div>
        <div class="toolbar">
          <div class="input-icon grow">
            ${icon('scan-barcode')}
            <label class="sr-only" for="pos-search">Search by name, brand or barcode</label>
            <input class="input" id="pos-search" type="search" placeholder="Name, brand, or scan a barcode" autocomplete="off" autofocus>
          </div>
          <div class="segmented" role="radiogroup" aria-label="Filter">
            <label><input type="radio" name="pos-rx" value="" checked><span>All</span></label>
            <label><input type="radio" name="pos-rx" value="otc"><span>OTC</span></label>
            <label><input type="radio" name="pos-rx" value="rx"><span>Rx</span></label>
          </div>
        </div>
        <div class="pos-results" id="pos-results" role="listbox" aria-label="Search results"></div>
      </section>

      <section class="panel cart" aria-labelledby="cart-title">
        <div class="panel-header">
          <h2 id="cart-title">Current sale</h2>
          <button class="btn btn-ghost btn-sm" type="button" id="cart-clear">Clear</button>
        </div>
        <div class="cart-controls" id="cart-controls"></div>
        <div class="cart-lines" id="cart-lines" aria-live="polite"></div>
        <div class="totals" id="cart-totals"></div>
        <div class="cart-footer">
          <div class="form-error" id="cart-error" role="alert" hidden></div>
          <button class="btn btn-primary btn-lg btn-block" type="button" id="charge">Charge</button>
        </div>
      </section>
    </div>`);

  const search = $('#pos-search', container);
  const resultsEl = $('#pos-results', container);
  let requestId = 0;

  const loadResults = async () => {
    const q = search.value.trim();
    const rx = container.querySelector('[name="pos-rx"]:checked').value;
    const id = ++requestId;
    try {
      const res = await api.get('/medicines', { q, rx, limit: 30, sort: 'generic_name' });
      if (id !== requestId) return;
      state.results = res.data;
      drawResults();
      return res.data;
    } catch (err) {
      render(resultsEl, html`<div class="state state-error">${icon('circle-alert')}<p>${err.message}</p></div>`);
      return [];
    }
  };

  const drawResults = () => {
    if (!state.results.length) {
      render(resultsEl, html`<div class="state">${icon('search')}<h3>No medicines found</h3><p>Check the spelling, or try the generic name.</p></div>`);
      return;
    }
    render(resultsEl, state.results.map((m, i) => html`
      <button class="pos-item" type="button" role="option" data-i="${i}" ${m.stock_on_hand <= 0 ? 'disabled' : ''} aria-selected="false">
        <span>
          <span class="name">${medicineName(m)} ${m.requires_prescription ? html`<span class="rx-tag" title="Prescription required">Rx</span>` : ''}</span>
          <span class="sub">${medicineSub(m)}</span>
        </span>
        ${expiryPill(m.nearest_expiry, m.days_to_expiry)}
        <span><span class="price">${money(m.price)}</span><span class="stock">${m.stock_on_hand > 0 ? `${num(m.stock_on_hand)} in stock` : 'Out of stock'}</span></span>
      </button>`));
  };

  const addToCart = (m, qty = 1) => {
    const line = state.cart.find((l) => l.medicine.medicine_id === m.medicine_id);
    const current = line?.quantity ?? 0;
    if (current + qty > m.stock_on_hand) {
      toast(`Only ${num(m.stock_on_hand)} ${m.unit}(s) of ${medicineName(m)} in stock.`, { type: 'error' });
      return;
    }
    if (line) line.quantity += qty;
    else state.cart.push({ medicine: m, quantity: qty });
    state.errors = {};
    drawCart();
  };

  on(resultsEl, 'click', '.pos-item', (_e, btn) => addToCart(state.results[Number(btn.dataset.i)]));
  on(resultsEl, 'keydown', '.pos-item', (e, btn) => {
    const items = [...resultsEl.querySelectorAll('.pos-item:not(:disabled)')];
    const i = items.indexOf(btn);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[i + 1]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] ?? search).focus(); }
  });

  search.addEventListener('input', debounce(loadResults, 180));
  container.querySelectorAll('[name="pos-rx"]').forEach((r) => r.addEventListener('change', loadResults));
  // Barcode scanners type the code then press Enter: an exact barcode match goes straight into the cart.
  search.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); resultsEl.querySelector('.pos-item:not(:disabled)')?.focus(); }
    if (e.key === 'Escape' && search.value) { e.preventDefault(); search.value = ''; loadResults(); }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const q = search.value.trim();
    const results = await loadResults();
    const exact = results.find((m) => m.barcode && m.barcode === q);
    const pick = exact ?? (results.length === 1 ? results[0] : null);
    if (pick && pick.stock_on_hand > 0) {
      addToCart(pick);
      search.value = '';
      loadResults();
    }
  });

  const cartLines = $('#cart-lines', container);
  on(cartLines, 'click', '[data-step]', (_e, btn) => {
    const line = state.cart[Number(btn.dataset.line)];
    const next = line.quantity + Number(btn.dataset.step);
    if (next < 1) return;
    if (next > line.medicine.stock_on_hand) { toast(`Only ${num(line.medicine.stock_on_hand)} in stock.`, { type: 'error' }); return; }
    line.quantity = next;
    state.errors = {};
    drawCart();
  });
  on(cartLines, 'change', '[data-qty]', (_e, input) => {
    const line = state.cart[Number(input.dataset.qty)];
    const value = Math.floor(Number(input.value));
    line.quantity = Math.max(1, Math.min(Number.isFinite(value) ? value : 1, line.medicine.stock_on_hand));
    state.errors = {};
    drawCart();
  });
  on(cartLines, 'click', '[data-remove]', (_e, btn) => {
    state.cart.splice(Number(btn.dataset.remove), 1);
    state.errors = {};
    drawCart();
  });

  const controls = $('#cart-controls', container);
  on(controls, 'click', '[data-clear-customer]', () => { state.customer = null; state.prescription = null; state.discount = 'none'; drawCart(); });
  on(controls, 'click', '[data-clear-rx]', () => { state.prescription = null; drawCart(); });
  on(controls, 'click', '[data-new-customer]', () => newCustomerDialog((c) => { setCustomer(c); }));
  on(controls, 'click', '[data-pick-rx]', () => prescriptionPicker());
  on(controls, 'change', '[name="discount"]', (e) => { state.discount = e.target.value; drawCart(); });

  $('#cart-clear', container).addEventListener('click', () => { reset(); drawCart(); search.focus(); });
  $('#charge', container).addEventListener('click', () => charge());

  const setCustomer = (c) => {
    state.customer = c;
    if (state.prescription && state.prescription.customer_id !== c.customer_id) state.prescription = null;
    state.discount = c.discount_id_type !== 'none' ? c.discount_id_type : 'none';
    drawCart();
  };

  function drawCart() {
    const c = state.customer;
    const rx = state.prescription;
    render(controls, html`
      ${c ? html`<div class="selected-chip">
          <span class="truncate">${icon('user', 'icon-sm')} <strong>${c.full_name}</strong>
            ${c.discount_id_type !== 'none' ? html`<span class="subtle small"> · ${DISCOUNT_LABELS[c.discount_id_type]} ${c.discount_id_no}</span>` : ''}</span>
          <button class="btn btn-ghost btn-icon btn-sm" type="button" data-clear-customer aria-label="Remove customer">${icon('x', 'icon-sm')}</button>
        </div>`
      : html`<div class="row">
          <div class="combo" style="flex:1">
            <label class="sr-only" for="pos-customer">Customer</label>
            <input class="input" id="pos-customer" placeholder="Customer (optional for walk-in)">
          </div>
          <button class="btn btn-icon" type="button" data-new-customer aria-label="Add new customer" title="Add new customer">${icon('user-plus')}</button>
        </div>`}
      ${rx ? html`<div class="selected-chip">
          <span class="truncate">${icon('clipboard-list', 'icon-sm')} Prescription <strong>#${rx.prescription_id}</strong> <span class="subtle small">· ${rx.doctor_name}</span></span>
          <button class="btn btn-ghost btn-icon btn-sm" type="button" data-clear-rx aria-label="Unlink prescription">${icon('x', 'icon-sm')}</button>
        </div>`
      : html`<button class="btn btn-block" type="button" data-pick-rx>${icon('clipboard-list')}Dispense a verified prescription</button>`}
      ${c && c.discount_id_type !== 'none' ? html`
        <div class="segmented segmented-block" role="radiogroup" aria-label="Discount">
          <label><input type="radio" name="discount" value="none" ${state.discount === 'none' ? 'checked' : ''}><span>No discount</span></label>
          <label><input type="radio" name="discount" value="${c.discount_id_type}" ${state.discount !== 'none' ? 'checked' : ''}><span>${DISCOUNT_LABELS[c.discount_id_type]} 20%</span></label>
        </div>` : ''}`);

    const input = $('#pos-customer', controls);
    if (input) combobox(input, { search: searchCustomers, option: customerOption, onSelect: setCustomer, minChars: 1, emptyText: 'No customer found. Use the add button to register one.' });

    const needsRx = (m) => m.requires_prescription && !rxCovers(m.medicine_id);
    render(cartLines, state.cart.length ? state.cart.map((l, i) => {
      const m = l.medicine;
      const err = state.errors[i] ?? (needsRx(m) ? 'Prescription required. Link a verified prescription.' : rxLimit(m, l.quantity));
      return html`<div class="cart-line ${err ? 'invalid' : ''}">
        <div>
          <div class="name">${medicineName(m)} ${m.requires_prescription ? html`<span class="rx-tag">Rx</span>` : ''}</div>
          <div class="sub">${m.brand} · ${money(m.price)} each</div>
        </div>
        <div class="line-total">${money(m.price * l.quantity)}</div>
        <div class="row">
          <div class="qty" role="group" aria-label="Quantity for ${medicineName(m)}">
            <button type="button" data-step="-1" data-line="${i}" aria-label="Decrease">${icon('minus', 'icon-sm')}</button>
            <input type="number" inputmode="numeric" min="1" max="${m.stock_on_hand}" value="${l.quantity}" data-qty="${i}" aria-label="Quantity">
            <button type="button" data-step="1" data-line="${i}" aria-label="Increase">${icon('plus', 'icon-sm')}</button>
          </div>
          <span class="small subtle">of ${num(m.stock_on_hand)}</span>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" type="button" data-remove="${i}" aria-label="Remove ${medicineName(m)}">${icon('trash-2', 'icon-sm')}</button>
        ${err ? html`<div class="line-error">${err}</div>` : ''}
      </div>`;
    }) : html`<div class="state">${icon('shopping-cart')}<p>Search or scan to add items. Prescription medicines need a verified prescription.</p></div>`);

    const t = totals();
    render($('#cart-totals', container), html`
      <div class="row-between"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
      ${state.discount !== 'none' ? html`
        <div class="row-between"><span>Less VAT (exempt)</span><span>−${money(t.subtotal - t.vat_exempt)}</span></div>
        <div class="row-between"><span>${DISCOUNT_LABELS[state.discount]} discount</span><span>−${money(t.discount_amount)}</span></div>`
      : html`<div class="row-between"><span>VAT included (12%)</span><span>${money(t.vat_amount)}</span></div>`}
      <div class="row-between grand"><span>Total</span><span>${money(t.total)}</span></div>`);

    const blocked = !state.cart.length || state.cart.some((l) => needsRx(l.medicine) || rxLimit(l.medicine, l.quantity));
    const chargeBtn = $('#charge', container);
    chargeBtn.disabled = blocked;
    chargeBtn.textContent = state.cart.length ? `Charge ${money(t.total)}` : 'Charge';
    $('#cart-error', container).hidden = true;
  }

  const rxItem = (medicineId) => state.prescription?.items.find((i) => i.medicine_id === medicineId);
  const rxCovers = (medicineId) => Boolean(rxItem(medicineId));
  const rxLimit = (m, qty) => {
    const item = rxItem(m.medicine_id);
    if (item && m.requires_prescription && qty > item.remaining) return `Prescription allows ${item.remaining} more.`;
    return '';
  };
  const totals = () => computeTotals(state.cart.map((l) => ({ unit_price: l.medicine.price, quantity: l.quantity })), state.discount);

  async function loadPrescription(id) {
    try {
      const { data: rx } = await api.get(`/prescriptions/${id}`);
      if (!['verified', 'partially_dispensed'].includes(rx.status)) {
        toast(rx.status === 'pending' ? 'This prescription still needs pharmacist verification.' : `Prescription #${rx.prescription_id} is ${rx.status.replace('_', ' ')}.`, { type: 'error' });
        return;
      }
      const { data: customer } = await api.get(`/customers/${rx.customer_id}`);
      state.customer = customer;
      state.discount = customer.discount_id_type !== 'none' ? customer.discount_id_type : 'none';
      state.prescription = rx;
      state.cart = state.cart.filter((l) => !l.medicine.requires_prescription);
      const meds = await Promise.all(rx.items.filter((i) => i.remaining > 0).map((i) => api.get(`/medicines/${i.medicine_id}`).then((r) => [i, r.data])));
      const short = [];
      for (const [item, m] of meds) {
        const qty = Math.min(item.remaining, m.stock_on_hand);
        if (qty < item.remaining) short.push(`${medicineName(m)} (${num(m.stock_on_hand)} of ${item.remaining} available)`);
        if (qty > 0) state.cart.push({ medicine: m, quantity: qty });
      }
      if (short.length) toast(`Not enough stock for: ${short.join(', ')}. Dispense what is available; the rest stays on the prescription.`, { type: 'info', duration: 8000 });
      drawCart();
    } catch (err) {
      toastError(err);
    }
  }

  async function prescriptionPicker() {
    const dlg = openDialog({
      title: 'Dispense a prescription',
      description: 'Verified prescriptions at this branch with medicine still to dispense.',
      body: html`<div id="rx-picker"><div class="state"><span class="skeleton" style="width:60%"></span></div></div>`,
      footer: html`<button class="btn" type="button" data-close>Cancel</button>`,
    });
    try {
      const params = { status: 'dispensable', limit: 50 };
      if (state.customer) params.customer = state.customer.customer_id;
      const { data } = await api.get('/prescriptions', params);
      const box = dlg.el.querySelector('#rx-picker');
      if (!data.length) {
        render(box, html`<div class="state">${icon('clipboard-list')}<h3>Nothing ready to dispense</h3>
          <p>${state.customer ? `${state.customer.full_name} has no verified prescriptions.` : 'A pharmacist must verify a prescription before it appears here.'}</p></div>`);
        return;
      }
      render(box, html`<div class="panel">${data.map((rx) => html`
        <button class="pos-item" type="button" data-rx="${rx.prescription_id}">
          <span><span class="name">#${rx.prescription_id} · ${rx.customer_name}</span>
            <span class="sub">${rx.doctor_name} · issued ${date(rx.date_issued)} · ${rx.item_count} item(s)</span></span>
          <span></span>
          <span class="pill pill-info">${rx.status === 'verified' ? 'Ready' : 'Partly dispensed'}</span>
        </button>`)}</div>`);
      box.querySelector('[data-rx]')?.focus();
      on(box, 'click', '[data-rx]', (_e, btn) => { dlg.close(); loadPrescription(btn.dataset.rx); });
    } catch (err) {
      dlg.close();
      toastError(err);
    }
  }

  function charge() {
    if ($('#charge', container).disabled) return;
    const t = totals();
    const quick = [...new Set([t.total, Math.ceil(t.total / 50) * 50, Math.ceil(t.total / 100) * 100, Math.ceil(t.total / 500) * 500, Math.ceil(t.total / 1000) * 1000])].slice(0, 4);
    const dlg = openDialog({
      title: `Collect ${money(t.total)}`,
      description: state.customer ? `Sale for ${state.customer.full_name}` : 'Walk-in sale',
      size: 'narrow',
      body: html`<form id="pay-form" novalidate class="stack">
        <div class="form-error" role="alert" hidden></div>
        <div class="segmented segmented-block" role="radiogroup" aria-label="Payment method">
          <label><input type="radio" name="payment_method" value="cash" checked><span>${icon('wallet', 'icon-sm')}Cash</span></label>
          <label><input type="radio" name="payment_method" value="gcash"><span>GCash</span></label>
          <label><input type="radio" name="payment_method" value="card"><span>Card</span></label>
        </div>
        <div data-cash class="stack">
          <div class="field">
            <label for="tendered">Amount received</label>
            <input class="input" id="tendered" name="amount_tendered" type="number" inputmode="decimal" min="${t.total}" step="0.01" value="${t.total.toFixed(2)}" aria-describedby="tendered-error" autofocus>
            <span class="error" id="tendered-error" data-error-for="amount_tendered"></span>
          </div>
          <div class="quick-cash">${quick.map((v) => html`<button class="btn btn-sm" type="button" data-amount="${v}">${v === t.total ? 'Exact' : money(v)}</button>`)}</div>
          <div class="row-between"><span class="muted">Change</span><span class="change-due" id="change-due">${money(0)}</span></div>
        </div>
        <div data-ref class="field" hidden>
          <label for="payment_ref">Reference number<span class="req" aria-hidden="true">*</span></label>
          <input class="input" id="payment_ref" name="payment_ref" maxlength="60" aria-describedby="ref-error" autocomplete="off">
          <span class="error" id="ref-error" data-error-for="payment_ref"></span>
        </div>
      </form>`,
      footer: html`<button class="btn" type="button" data-close>Back to cart</button>
        <button class="btn btn-primary" type="submit" form="pay-form">Complete sale</button>`,
    });
    const form = dlg.el.querySelector('#pay-form');
    const tendered = form.querySelector('#tendered');
    tendered.select();
    const updateChange = () => {
      const change = Number(tendered.value) - t.total;
      form.querySelector('#change-due').textContent = money(change > 0 ? change : 0);
    };
    tendered.addEventListener('input', updateChange);
    on(form, 'click', '[data-amount]', (_e, b) => { tendered.value = Number(b.dataset.amount).toFixed(2); updateChange(); });
    form.querySelectorAll('[name="payment_method"]').forEach((r) => r.addEventListener('change', () => {
      const cash = r.value === 'cash' && r.checked;
      form.querySelector('[data-cash]').hidden = !cash;
      form.querySelector('[data-ref]').hidden = cash;
      (cash ? tendered : form.querySelector('#payment_ref')).focus();
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const method = form.querySelector('[name="payment_method"]:checked').value;
      const ref = form.querySelector('#payment_ref').value.trim();
      if (method === 'cash' && !(Number(tendered.value) >= t.total)) return showErrors(form, { amount_tendered: `Collect at least ${money(t.total)}.` });
      if (method !== 'cash' && !ref) return showErrors(form, { payment_ref: 'Enter the GCash or card reference number.' });

      const body = {
        items: state.cart.map((l) => ({ medicine_id: l.medicine.medicine_id, quantity: l.quantity })),
        customer_id: state.customer?.customer_id ?? null,
        prescription_id: state.prescription?.prescription_id ?? null,
        discount_type: state.discount,
        payment_method: method,
        amount_tendered: method === 'cash' ? Number(tendered.value) : undefined,
        payment_ref: method === 'cash' ? null : ref,
      };
      await withBusy(dlg.el.querySelector('[type="submit"]'), async () => {
        try {
          const res = await api.post('/sales', body);
          dlg.close();
          reset();
          drawCart();
          loadResults();
          dataChanged();
          toast(res.message);
          const receipt = await openReceipt(res.data);
          receipt?.closed.then(() => search.focus());
        } catch (err) {
          if (err.errors && Object.keys(err.errors).some((k) => k.startsWith('items.'))) {
            dlg.close();
            state.errors = Object.fromEntries(Object.entries(err.errors).filter(([k]) => k.startsWith('items.')).map(([k, v]) => [Number(k.split('.')[1]), v]));
            drawCart();
            const box = $('#cart-error', container);
            box.textContent = err.message;
            box.hidden = false;
            $('#charge', container).disabled = true;
          } else {
            showErrors(form, err.errors, err.message);
          }
        }
      });
    });
  }

  function newCustomerDialog(onCreated) {
    const dlg = openDialog({
      title: 'New customer',
      body: html`<form id="quick-customer" class="form-grid" novalidate>
        <div class="form-error span-2" role="alert" hidden></div>
        ${fields([
          { name: 'firstname', label: 'First name', required: true, attrs: { maxlength: 60, autofocus: '' } },
          { name: 'lastname', label: 'Last name', required: true, attrs: { maxlength: 60 } },
          { name: 'phone', label: 'Mobile number', type: 'tel', attrs: { maxlength: 20 } },
          { name: 'birthdate', label: 'Birthdate', type: 'date', attrs: { max: new Date().toISOString().slice(0, 10) } },
          { name: 'discount_id_type', label: 'Discount ID', type: 'select', options: [['none', 'None'], ['senior', 'Senior citizen'], ['pwd', 'PWD']] },
          { name: 'discount_id_no', label: 'ID number', hint: 'Required for Senior Citizen or PWD discounts', attrs: { maxlength: 40 } },
        ])}
      </form>`,
      footer: html`<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="submit" form="quick-customer">Save customer</button>`,
    });
    handleForm(dlg.el.querySelector('form'), async (data) => {
      const res = await api.post('/customers', data);
      dlg.close();
      toast(res.message);
      onCreated(res.data);
    });
  }

  const onKey = (e) => {
    if (document.querySelector('dialog[open]')) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (e.key === '/' && !typing) { e.preventDefault(); search.focus(); search.select(); }
    if (e.key === 'F9') { e.preventDefault(); charge(); }
  };
  document.addEventListener('keydown', onKey);

  drawCart();
  await loadResults();
  if (query?.rx) loadPrescription(query.rx);
  return () => document.removeEventListener('keydown', onKey);
}
export { render_ as render };
