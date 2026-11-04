import { api, qs } from '../api.js';
import { html, render as draw, $ } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, date, today, daysFromToday } from '../format.js';
import { pageHeader, branchFilter } from './shared.js';

const REPORTS = [
  ['daily-sales', 'Daily sales', 'Transactions, discounts, VAT and net sales per day.', 'range'],
  ['sales-by-medicine', 'Sales by medicine', 'Units sold, revenue and gross profit per medicine.', 'range'],
  ['stock-status', 'Stock status', 'Sellable and expired units, stock value at cost, and reorder status.', 'none'],
  ['expiring', 'Expiring stock', 'Batches that are expired or expire within the chosen number of days.', 'days'],
  ['branch-summary', 'Branch summary', 'Sales and stock value side by side for each branch.', 'range'],
];
const MONEY = new Set(['gross', 'discounts', 'vat', 'net', 'revenue', 'gross_profit', 'stock_value', 'value_at_cost', 'average_sale', 'expired_value']);
const DATES = new Set(['day', 'expiry_date', 'nearest_expiry']);

export async function render(container, { query }) {
  let current = REPORTS.find(([k]) => k === query?.name) ?? REPORTS[0];
  draw(container, html`
    ${pageHeader('Reports', 'Figures are calculated live from recorded sales and batches.')}
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
        <span data-show="days" class="row">
          <label class="small muted" for="r-days">Within</label>
          <select class="select" id="r-days" name="days"><option value="30">30 days</option><option value="90" selected>90 days</option><option value="180">180 days</option><option value="365">1 year</option></select>
        </span>
        ${await branchFilter('branch')}
        <a class="btn" id="csv" href="#">${icon('download', 'icon-sm')}Download CSV</a>
      </form>
      <div id="report-body" aria-live="polite"></div>
    </section>`);

  const filters = $('#report-filters', container);
  const body = $('#report-body', container);

  const params = () => {
    const fd = new FormData(filters);
    const p = { branch: fd.get('branch') || undefined };
    if (current[3] === 'range') Object.assign(p, { from: fd.get('from'), to: fd.get('to') });
    if (current[3] === 'days') p.days = fd.get('days');
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
      if (!res.data.length) { draw(body, html`<div class="state">${icon('chart-column')}<h3>No data for this period</h3><p>Try a wider date range.</p></div>`); return; }
      const numeric = (k) => MONEY.has(k) || ['transactions', 'voided', 'quantity', 'stock_on_hand', 'expired_qty', 'reorder_level', 'qty_on_hand', 'days_left'].includes(k);
      const cell = (k, v) => (MONEY.has(k) ? money(v) : DATES.has(k) ? (v ? date(v) : '') : typeof v === 'number' ? num(v) : v ?? '');
      const totals = cols.map((c) => (MONEY.has(c.key) && c.key !== 'average_sale') || ['transactions', 'voided', 'quantity'].includes(c.key)
        ? res.data.reduce((s, r) => s + Number(r[c.key] || 0), 0) : null);
      draw(body, html`<div class="table-wrap"><table class="table"><caption class="sr-only">${res.meta.title}</caption>
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
  filters.addEventListener('submit', (e) => e.preventDefault());
  await load();
}
