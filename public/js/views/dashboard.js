import { api } from '../api.js';
import { html, render, $ } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, shortDate, time, date, compactMoney, statusPill, expiryPill, medicineName, PAYMENT_LABELS } from '../format.js';
import { session, can, ROLES } from '../session.js';
import { pageHeader, branchFilter } from './shared.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export async function render_(container) {
  const filter = await branchFilter('branch');
  render(container, html`
    ${pageHeader(`${greeting()}, ${session.user.full_name.split(' ')[0]}`,
      session.user.branch_name ? `Here is how ${session.user.branch_name} is doing today.` : 'Here is how every branch is doing today.',
      html`${filter}
        ${can(...ROLES.SELLING) ? html`<a class="btn btn-primary" href="#/pos">${icon('shopping-cart')}Open POS</a>` : ''}`)}
    <div id="dash-body" aria-live="polite"></div>`);

  const body = $('#dash-body', container);
  const load = async () => {
    render(body, html`<div class="stats">${Array.from({ length: 4 }, () => html`<div class="stat"><span class="skeleton" style="width:40%"></span><span class="skeleton" style="width:65%;height:1.6rem;margin-top:.4rem"></span></div>`)}</div>`);
    try {
      const branch = $('#filter-branch', container)?.value;
      const { data } = await api.get('/dashboard', { branch });
      draw(body, data);
    } catch (err) {
      render(body, html`<div class="panel state state-error" role="alert">${icon('circle-alert')}<h3>Could not load the dashboard</h3><p>${err.message}</p>
        <button class="btn" type="button" id="dash-retry">${icon('refresh-cw', 'icon-sm')}Try again</button></div>`);
      $('#dash-retry', body).addEventListener('click', load);
    }
  };
  $('#filter-branch', container)?.addEventListener('change', load);
  await load();
}
export { render_ as render };

function delta(today, yesterday) {
  if (!yesterday) return html`<span>No sales yesterday to compare</span>`;
  const pct = ((today - yesterday) / yesterday) * 100;
  const up = pct >= 0;
  return html`<span class="${up ? 'up' : 'down'}">${up ? '+' : '−'}${Math.abs(pct).toFixed(0)}%</span> vs yesterday so far`;
}

function draw(body, d) {
  const lowTotal = Number(d.stock.low_stock);
  const attention = Number(d.stock.expired) + Number(d.stock.near_expiry);
  render(body, html`
    <section class="stack">
      <div class="stats">
        <div class="stat stat-primary">
          <span class="label">Sales today</span>
          <span class="value">${money(d.today.revenue)}</span>
          <span class="meta">${num(d.today.transactions)} transactions · ${delta(d.today.revenue, d.yesterday.revenue)}</span>
        </div>
        ${can(...ROLES.DISPENSING) ? html`
        <a class="stat" href="#/prescriptions?status=pending">
          <span class="label">Prescriptions to review</span>
          <span class="value ${d.prescriptions.pending ? 'warn' : ''}">${num(d.prescriptions.pending)}</span>
          <span class="meta">${num(d.prescriptions.ready)} verified and ready to dispense</span>
        </a>` : html`
        <div class="stat">
          <span class="label">Prescriptions ready</span>
          <span class="value">${num(d.prescriptions.ready)}</span>
          <span class="meta">Verified by a pharmacist, waiting at the counter</span>
        </div>`}
        <a class="stat" href="${can(...ROLES.DISPENSING) ? '#/inventory?tab=alerts' : '#/medicines?stock=low'}">
          <span class="label">Low or out of stock</span>
          <span class="value ${lowTotal ? 'warn' : ''}">${num(lowTotal)}</span>
          <span class="meta">Medicines at or below their reorder level</span>
        </a>
        <a class="stat" href="${can(...ROLES.DISPENSING) ? '#/inventory?tab=alerts' : '#/medicines'}">
          <span class="label">Expiry alerts</span>
          <span class="value ${Number(d.stock.expired) ? 'danger' : attention ? 'warn' : ''}">${num(attention)}</span>
          <span class="meta">${num(d.stock.expired)} expired, ${num(d.stock.near_expiry)} within ${d.near_expiry_days} days</span>
        </a>
      </div>

      <div class="grid-main-side">
        <section class="panel" aria-labelledby="chart-title">
          <div class="panel-header">
            <div><h2 id="chart-title">Net sales, last 14 days</h2><p class="small subtle">Completed sales after discounts</p></div>
            <span class="small muted">${money(d.daily.reduce((s, x) => s + x.revenue, 0))} total</span>
          </div>
          <div class="panel-body">${salesChart(d.daily)}</div>
        </section>

        <section class="panel" aria-labelledby="top-title">
          <div class="panel-header"><h2 id="top-title">Top sellers, 30 days</h2><span class="small subtle">By units</span></div>
          <div class="panel-body">
            ${d.top_medicines.length ? html`<div class="rank">
              ${d.top_medicines.map((m) => html`<div class="rank-row">
                <span class="truncate"><strong>${medicineName(m)}</strong> <span class="subtle">${m.brand}</span></span>
                <span class="num small">${num(m.quantity)} units</span>
                <div class="rank-track" aria-hidden="true"><div class="rank-fill" style="width:${(m.quantity / d.top_medicines[0].quantity) * 100}%"></div></div>
              </div>`)}</div>`
              : html`<div class="state"><p>No sales in the last 30 days.</p></div>`}
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="panel" aria-labelledby="recent-title">
          <div class="panel-header"><h2 id="recent-title">Latest sales</h2><a class="btn btn-sm" href="#/sales">View all</a></div>
          ${d.recent_sales.length ? html`<div>${d.recent_sales.map((s) => html`
            <a class="list-row" href="#/sales/${s.sale_id}">
              <span><span class="mono">${s.receipt_no}</span><span class="secondary-line small subtle">${s.customer_name ?? 'Walk-in'} · ${PAYMENT_LABELS[s.payment_method]} · ${shortDate(s.created_at)} ${time(s.created_at)}</span></span>
              <span class="row"><span class="num">${money(s.total)}</span>${s.status === 'voided' ? statusPill('voided') : ''}</span>
            </a>`)}</div>` : html`<div class="state"><p>No sales recorded yet.</p></div>`}
        </section>

        <section class="panel" aria-labelledby="pay-title">
          <div class="panel-header"><h2 id="pay-title">Today by payment method</h2></div>
          <div class="panel-body stack">
            ${['cash', 'gcash', 'card'].map((k) => html`<div class="row-between"><span>${PAYMENT_LABELS[k]}</span><span class="num">${money(d.today[k])}</span></div>`)}
            <div class="row-between"><span class="muted">Senior and PWD discounts given</span><span class="num">${money(d.today.discounts)}</span></div>
            ${d.transfers && can(...ROLES.MANAGEMENT) && (d.transfers.to_dispatch || d.transfers.to_receive) ? html`
              <a class="callout" href="#/transfers">${icon('arrow-left-right')}<span>${d.transfers.to_dispatch} transfer request(s) to dispatch, ${d.transfers.to_receive} shipment(s) to receive.</span></a>` : ''}
            ${(d.license_alerts ?? []).map((p) => html`
              <div class="callout ${p.days_left < 0 ? 'callout-danger' : 'callout-warn'}">${icon('triangle-alert')}
                <span>${p.name}'s PRC license (${p.license_no}) ${p.days_left < 0 ? `expired on ${date(p.license_expiry)}` : `expires in ${p.days_left} days`}.</span></div>`)}
          </div>
        </section>
      </div>

      ${d.branches ? html`
      <section class="panel" aria-labelledby="branches-title">
        <div class="panel-header"><h2 id="branches-title">Branches</h2></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Branch</th><th scope="col" class="num">Sales today</th><th scope="col" class="num">Transactions today</th><th scope="col" class="num">Net sales, 30 days</th></tr></thead>
          <tbody>${d.branches.map((b) => html`<tr><td class="primary-cell">${b.name}</td><td class="num">${money(b.today_revenue)}</td><td class="num">${num(b.today_transactions)}</td><td class="num">${money(b.revenue_30d)}</td></tr>`)}</tbody>
        </table></div>
      </section>` : ''}
    </section>`);
  wireChart(body);
}

// Single-series column chart: accent bars (24px max, 4px rounded tops, square at the baseline),
// hairline gridlines, a hover/focus tooltip per bar, and a visually hidden table for screen readers.
function salesChart(days) {
  const W = 640; const H = 220; const pad = { t: 8, r: 8, b: 26, l: 48 };
  const max = Math.max(...days.map((d) => d.revenue), 1);
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const plotW = W - pad.l - pad.r; const plotH = H - pad.t - pad.b;
  const band = plotW / days.length;
  const barW = Math.min(24, band - 6);
  const y = (v) => pad.t + plotH - (v / top) * plotH;
  const r = 4;
  const barPath = (x, v) => {
    const h = Math.max(0, (v / top) * plotH);
    if (h < 1) return '';
    const rr = Math.min(r, h, barW / 2);
    const yTop = y(v); const yBase = pad.t + plotH;
    return `M${x},${yBase}V${yTop + rr}Q${x},${yTop} ${x + rr},${yTop}H${x + barW - rr}Q${x + barW},${yTop} ${x + barW},${yTop + rr}V${yBase}Z`;
  };

  return html`<div class="chart" data-chart>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Column chart of net sales for the last 14 days. Highest day ${money(max)}.">
      ${ticks.map((t) => html`<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"></line>
        <text class="axis-label" x="${pad.l - 8}" y="${y(t) + 4}" text-anchor="end">${compactMoney(t).replace('.00', '')}</text>`)}
      ${days.map((d, i) => {
        const x = pad.l + i * band + (band - barW) / 2;
        const isToday = i === days.length - 1;
        return html`
          <rect class="hit" x="${pad.l + i * band}" y="${pad.t}" width="${band}" height="${plotH}" tabindex="0"
            data-tip="${shortDate(d.day)}${isToday ? ' (today, so far)' : ''}|${money(d.revenue)}|${d.transactions} transactions" data-x="${x + barW / 2}" data-y="${y(d.revenue)}"
            aria-label="${shortDate(d.day)}: ${money(d.revenue)}, ${d.transactions} transactions"></rect>
          <path class="bar ${isToday ? '' : ''}" d="${barPath(x, d.revenue)}"></path>
          ${i % 2 === (days.length - 1) % 2 ? html`<text class="axis-label" x="${x + barW / 2}" y="${H - 8}" text-anchor="middle">${isToday ? 'Today' : shortDate(d.day)}</text>` : ''}`;
      })}
    </svg>
    <div class="chart-tooltip" role="tooltip" hidden></div>
    <table class="sr-only"><caption>Net sales by day</caption><thead><tr><th>Date</th><th>Net sales</th><th>Transactions</th></tr></thead>
      <tbody>${days.map((d) => html`<tr><td>${d.day}</td><td>${money(d.revenue)}</td><td>${d.transactions}</td></tr>`)}</tbody></table>
  </div>`;
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function wireChart(root) {
  const chart = root.querySelector('[data-chart]');
  if (!chart) return;
  const svg = chart.querySelector('svg');
  const tip = chart.querySelector('.chart-tooltip');
  const show = (rect) => {
    const [label, value, count] = rect.dataset.tip.split('|');
    render(tip, html`<span class="small subtle">${label}</span><strong>${value}</strong><span class="small muted">${count}</span>`);
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    tip.style.left = `${Number(rect.dataset.x) * scale}px`;
    tip.style.top = `${Number(rect.dataset.y) * scale}px`;
    tip.hidden = false;
  };
  const hide = () => { tip.hidden = true; };
  svg.querySelectorAll('.hit').forEach((rect) => {
    rect.addEventListener('pointerenter', () => show(rect));
    rect.addEventListener('focus', () => show(rect));
    rect.addEventListener('pointerleave', hide);
    rect.addEventListener('blur', hide);
  });
}
