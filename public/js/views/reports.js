import { api, qs } from '../api.js';
import { html, render as draw, $ } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, date, today, daysFromToday } from '../format.js';
import { pageHeader, branchFilter } from './shared.js';

// Three reports cover what managers ask for: money in, what sells, and what is on (or should leave) the shelf.
const REPORTS = [
  ['daily-sales', 'Sales summary', 'Sales per day: how many, discounts given, VAT, and the total collected.', 'range'],
  ['sales-by-medicine', 'Best-selling medicines', 'Which medicines sold the most in these dates, and what they earned.', 'range'],
  ['stock-status', 'Stock and expiry', 'How much of each medicine is in stock right now, what expires soon, and what has expired.', 'none'],
];
const MONEY = new Set(['gross', 'discounts', 'vat', 'net', 'revenue', 'gross_profit', 'stock_value']);
const DATES = new Set(['day', 'expiry_date', 'nearest_expiry']);

export async function render(container, { query }) {
  let current = REPORTS.find(([k]) => k === query?.name) ?? REPORTS[0];
  draw(container, html`
    ${pageHeader('Reports', 'Pick a report, choose the dates, then print it or download it for Excel.')}
    <section class="panel">
      <div class="tabs" role="tablist" aria-label="Reports">
        ${REPORTS.map(([k, l]) => html`<button type="button" role="tab" data-report="${k}" aria-selected="${k === current[0]}">${l}</button>`)}
      </div>
      <form class="toolbar" id="report-filters">
        <p class="small muted grow" id="report-desc"></p>
        <span data-show="range" class="row">
          <label class="small muted" for="r-from">From</label><input class="input" id="r-from" type="date" name="from" value="${daysFromToday(-29)}" max="${today()}">
          <label class="small muted" for="r-to">To</label><input class="input" id="r-to" type="date" name="to" value="${today()}" max="${today()}">
        </span>
        ${await branchFilter('branch')}
        <button class="btn" type="button" id="print">${icon('printer', 'icon-sm')}Print</button>
        <a class="btn" id="csv" href="#">${icon('download', 'icon-sm')}Download (Excel/CSV)</a>
      </form>
      <div id="report-body" aria-live="polite"></div>
    </section>`);

  const filters = $('#report-filters', container);
  const body = $('#report-body', container);

  const params = () => {
    const fd = new FormData(filters);
    const p = { branch: fd.get('branch') || undefined };
    if (current[3] === 'range') Object.assign(p, { from: fd.get('from'), to: fd.get('to') });
    return p;
  };

  const load = async () => {
    $('#report-desc', container).textContent = current[2];
    filters.querySelectorAll('[data-show]').forEach((el) => { el.hidden = el.dataset.show !== current[3]; });
    container.querySelectorAll('[data-report]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.report === current[0])));
    $('#csv', container).href = `/api/reports/${current[0]}${qs({ ...params(), format: 'csv' })}`;
    draw(body, html`<div class="state"><span class="skeleton" style="width:50%"></span></div>`);
    try {
      const res = await api.get(`/reports/${current[0]}`, params());
      const cols = res.meta.columns;
      if (!res.data.length) { draw(body, html`<div class="state">${icon('chart-column')}<h3>Nothing in these dates</h3><p>Try a wider date range.</p></div>`); return; }
      const numeric = (k) => MONEY.has(k) || ['transactions', 'voided', 'quantity', 'stock_on_hand', 'expired_qty', 'expiring_qty', 'reorder_level'].includes(k);
      const cell = (k, v) => (MONEY.has(k) ? money(v) : DATES.has(k) ? (v ? date(v) : '') : typeof v === 'number' ? num(v) : v ?? '');
      const totals = cols.map((c) => MONEY.has(c.key) || ['transactions', 'voided', 'quantity'].includes(c.key)
        ? res.data.reduce((s, r) => s + Number(r[c.key] || 0), 0) : null);
      const range = current[3] === 'range' ? `${date(res.meta.from)} to ${date(res.meta.to)}` : `As of ${date(today())}`;
      draw(body, html`<div class="print-only report-heading"><h2>${res.meta.title}</h2><p>${range}</p></div>
        <div class="table-wrap"><table class="table"><caption class="sr-only">${res.meta.title}</caption>
        <thead><tr>${cols.map((c) => html`<th scope="col" class="${numeric(c.key) ? 'num' : ''}">${c.label}</th>`)}</tr></thead>
        <tbody>${res.data.map((r) => html`<tr>${cols.map((c) => html`<td class="${numeric(c.key) ? 'num' : ''}">${cell(c.key, r[c.key])}</td>`)}</tr>`)}</tbody>
        ${totals.some((t) => t !== null) ? html`<tfoot><tr>${cols.map((c, i) => html`<td class="${numeric(c.key) ? 'num' : ''}"><strong>${i === 0 ? 'Total' : totals[i] !== null ? cell(c.key, totals[i]) : ''}</strong></td>`)}</tr></tfoot>` : ''}
      </table></div>`);
    } catch (err) {
      draw(body, html`<div class="state state-error">${icon('circle-alert')}<h3>Could not run this report</h3><p>${err.message}</p></div>`);
    }
  };

  container.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-report]');
    if (tab) { current = REPORTS.find(([k]) => k === tab.dataset.report); load(); }
  });
  filters.addEventListener('change', load);
  $('#print', container).addEventListener('click', () => window.print());
  filters.addEventListener('submit', (e) => e.preventDefault());
  await load();
}
