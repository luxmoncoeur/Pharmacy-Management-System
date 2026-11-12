// End of day: count the cash drawer against what the system expects, then print a closing slip.
// Nothing is saved: the signed slip is the record, so it is printed for the branch's files.
import { api } from '../api.js';
import { html, render, $ } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, date, dateTime, time, today } from '../format.js';
import { session, can, ROLES } from '../session.js';
import { openDialog } from '../ui/dialog.js';
import { toastError } from '../ui/toast.js';

const BILLS = [1000, 500, 200, 100, 50, 20];
const cents = (n) => Math.round((Number(n) || 0) * 100);

export async function closeDayDialog() {
  const manager = can(...ROLES.MANAGEMENT);
  let staff = [];
  if (manager) {
    try {
      staff = (await api.get('/users', { limit: 200, sort: 'full_name' })).data.filter((u) => u.branch_id && u.is_active);
    } catch (err) { toastError(err); return; }
  }
  const startId = session.user.branch_id ? session.user.user_id : staff[0]?.user_id;
  if (!startId) { toastError(new Error('No staff at a branch to count for yet.')); return; }

  const dlg = openDialog({
    title: 'Close the day',
    description: 'Count the cash in the drawer and compare it with today\'s cash sales. Print the slip, sign it, and keep it with the day\'s papers.',
    className: 'cash-slip-dialog',
    body: html`<form id="cash-form" class="stack cash-form" novalidate>
      ${manager ? html`<div class="form-grid">
        <div class="field"><label for="cash-who">Whose sales</label>
          <select class="select" id="cash-who" name="cashier">${staff.map((u) => html`<option value="${u.user_id}" ${u.user_id === startId ? 'selected' : ''}>${u.full_name}${u.branch_name ? ` · ${u.branch_name}` : ''}</option>`)}</select></div>
        <div class="field"><label for="cash-date">Day</label><input class="input" id="cash-date" type="date" name="date" value="${today()}" max="${today()}"></div>
      </div>` : ''}
      <div id="cash-summary" aria-live="polite"><span class="skeleton" style="width:60%"></span></div>
      <div class="field"><label for="cash-float">Opening cash (float)</label>
        <input class="input" id="cash-float" name="float" type="number" min="0" step="0.01" value="0" inputmode="decimal">
        <span class="hint">The change fund that was in the drawer at the start of the day.</span></div>
      <fieldset class="field"><legend>Cash counted in the drawer</legend>
        <div class="cash-grid">
          ${BILLS.map((b) => html`<label for="bill-${b}">₱${num(b)} ×</label>
            <input class="input" id="bill-${b}" name="bill-${b}" type="number" min="0" step="1" inputmode="numeric" placeholder="0">
            <span class="num" data-line="${b}">${money(0)}</span>`)}
          <label for="coins">Coins (total)</label>
          <input class="input" id="coins" name="coins" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">
          <span class="num" data-line="coins">${money(0)}</span>
        </div>
      </fieldset>
      <div id="cash-result"></div>
      <div class="field"><label for="cash-note">Note (optional, printed on the slip)</label>
        <textarea class="textarea" id="cash-note" name="note" maxlength="300" placeholder="₱20 short: change given twice to one customer"></textarea></div>
    </form>
    <article class="receipt cash-slip" id="cash-slip" aria-hidden="true"></article>`,
    footer: html`<button class="btn" type="button" data-close>Close</button>
      <button class="btn btn-primary" type="button" data-print-slip>${icon('printer')}Print closing slip</button>`,
  });

  const form = $('#cash-form', dlg.el);
  let summary = null;

  const counted = () => {
    const fd = new FormData(form);
    const bills = BILLS.map((b) => [b, Math.max(0, Math.floor(Number(fd.get(`bill-${b}`)) || 0))]);
    const coins = Math.max(0, Number(fd.get('coins')) || 0);
    const total = (bills.reduce((s, [b, n]) => s + cents(b) * n, 0) + cents(coins)) / 100;
    return { bills, coins, total, float: Math.max(0, Number(fd.get('float')) || 0), note: String(fd.get('note') ?? '').trim() };
  };

  const result = () => {
    if (!summary) return null;
    const c = counted();
    const expected = (cents(c.float) + cents(summary.cash)) / 100;
    const diff = (cents(c.total) - cents(expected)) / 100;
    return { ...c, expected, diff, label: diff === 0 ? 'Balanced' : diff < 0 ? `Short ${money(-diff)}` : `Over ${money(diff)}`, cls: diff === 0 ? 'balanced' : diff < 0 ? 'short' : 'over' };
  };

  const drawResult = () => {
    const c = counted();
    BILLS.forEach((b) => { $(`[data-line="${b}"]`, form).textContent = money(b * (c.bills.find(([x]) => x === b)[1])); });
    $('[data-line="coins"]', form).textContent = money(c.coins);
    const r = result();
    render($('#cash-result', form), r ? html`
      <div class="cash-figures">
        <div class="row-between"><span>Opening cash + cash sales (expected)</span><strong class="num">${money(r.expected)}</strong></div>
        <div class="row-between"><span>Counted</span><strong class="num">${money(r.total)}</strong></div>
      </div>
      <div class="cash-result ${r.cls}" role="status" style="margin-top:var(--space-3)"><span>${r.label}</span><span class="num">${money(r.diff)}</span></div>` : '');
  };

  const load = async () => {
    const fd = new FormData(form);
    render($('#cash-summary', form), html`<span class="skeleton" style="width:60%"></span>`);
    try {
      summary = (await api.get('/cash/summary', manager ? { cashier: fd.get('cashier'), date: fd.get('date') } : {})).data;
      const s = summary;
      render($('#cash-summary', form), html`<section class="panel"><div class="panel-body cash-figures">
        <div class="row-between"><span class="muted">${s.person.full_name} · ${s.person.branch_name} · ${date(s.date)}</span>
          <span class="small subtle">${s.first_sale_at ? `${time(s.first_sale_at)} to ${time(s.last_sale_at)}` : 'No sales'}</span></div>
        <div class="row-between"><span>Cash sales (${num(s.cash_count)})</span><strong class="num">${money(s.cash)}</strong></div>
        <div class="row-between"><span>GCash</span><span class="num">${money(s.gcash)}</span></div>
        <div class="row-between"><span>Card</span><span class="num">${money(s.card)}</span></div>
        <div class="row-between" style="border-top:1px solid var(--border);padding-top:var(--space-2)"><strong>All sales (${num(s.transactions)})</strong><strong class="num">${money(s.total)}</strong></div>
        ${s.voided_count ? html`<div class="small subtle">${num(s.voided_count)} voided sale${s.voided_count === 1 ? '' : 's'} (${money(s.voided_total)}) not counted.</div>` : ''}
      </div></section>`);
    } catch (err) {
      summary = null;
      render($('#cash-summary', form), html`<div class="callout callout-danger">${icon('circle-alert')}<span>${err.message}</span></div>`);
    }
    drawResult();
  };

  const drawSlip = () => {
    const s = summary;
    const r = result();
    render($('#cash-slip', dlg.el), html`
      <header><strong>${s.person.branch_name}</strong><span>${s.person.branch_address ?? ''}</span><span>END-OF-DAY CASH COUNT</span></header>
      <div class="r-section">
        <div class="r-line"><span>Date</span><span>${date(s.date)}</span></div>
        <div class="r-line"><span>Staff</span><span>${s.person.full_name}</span></div>
        <div class="r-line"><span>Printed</span><span>${dateTime(new Date().toLocaleString('sv-SE').replace('T', ' '))}</span></div>
      </div>
      <div class="r-section">
        <div class="r-line"><span>Cash sales (${num(s.cash_count)})</span><span>${money(s.cash)}</span></div>
        <div class="r-line"><span>GCash</span><span>${money(s.gcash)}</span></div>
        <div class="r-line"><span>Card</span><span>${money(s.card)}</span></div>
        <div class="r-line"><strong>All sales (${num(s.transactions)})</strong><strong>${money(s.total)}</strong></div>
        ${s.voided_count ? html`<div class="r-line"><span>Voided (${num(s.voided_count)})</span><span>${money(s.voided_total)}</span></div>` : ''}
      </div>
      <div class="r-section">
        ${r.bills.filter(([, n]) => n > 0).map(([b, n]) => html`<div class="r-line"><span>₱${num(b)} × ${num(n)}</span><span>${money(b * n)}</span></div>`)}
        ${r.coins ? html`<div class="r-line"><span>Coins</span><span>${money(r.coins)}</span></div>` : ''}
        <div class="r-line"><strong>Counted</strong><strong>${money(r.total)}</strong></div>
      </div>
      <div class="r-section">
        <div class="r-line"><span>Opening cash</span><span>${money(r.float)}</span></div>
        <div class="r-line"><span>Expected in drawer</span><span>${money(r.expected)}</span></div>
        <div class="r-line"><strong>${r.label.toUpperCase()}</strong><strong>${money(r.diff)}</strong></div>
        ${r.note ? html`<div>Note: ${r.note}</div>` : ''}
      </div>
      <div class="r-section"><div>Counted by: ______________________</div><div style="margin-top:1.25rem">Received by: ____________________</div></div>`);
  };

  form.addEventListener('input', (e) => { if (!['cashier', 'date'].includes(e.target.name)) drawResult(); });
  form.addEventListener('change', (e) => { if (['cashier', 'date'].includes(e.target.name)) load(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  dlg.el.querySelector('[data-print-slip]').addEventListener('click', () => {
    if (!summary) return;
    drawSlip();
    window.print();
  });
  await load();
  return dlg;
}
