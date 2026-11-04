// Home: the few things staff need at a glance, plus big buttons for the most common jobs.
import { api } from '../api.js';
import { html, render, $ } from '../dom.js';
import { icon } from '../icons.js';
import { money, num, shortDate, time, date, statusPill, expiryPill, medicineName, PAYMENT_LABELS } from '../format.js';
import { session, can, canSell, ROLES } from '../session.js';
import { pageHeader, branchFilter } from './shared.js';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export async function render_(container) {
  const filter = await branchFilter('branch');
  render(container, html`
    ${pageHeader(`${greeting()}, ${session.user.full_name.split(' ')[0]}`,
      session.user.branch_name ? `Here is ${session.user.branch_name} today.` : 'Here is every branch today.', filter)}
    <div id="dash-body" aria-live="polite"></div>`);

  const body = $('#dash-body', container);
  const load = async () => {
    render(body, html`<div class="stats">${Array.from({ length: 3 }, () => html`<div class="stat"><span class="skeleton" style="width:40%"></span><span class="skeleton" style="width:65%;height:1.6rem;margin-top:.4rem"></span></div>`)}</div>`);
    try {
      const branch = $('#filter-branch', container)?.value;
      const [{ data }, { data: alerts }] = await Promise.all([api.get('/dashboard', { branch }), api.get('/inventory/alerts', { branch })]);
      draw(body, data, alerts);
    } catch (err) {
      render(body, html`<div class="panel state state-error" role="alert">${icon('circle-alert')}<h3>Could not load Home</h3><p>${err.message}</p>
        <button class="btn" type="button" id="dash-retry">${icon('refresh-cw', 'icon-sm')}Try again</button></div>`);
      $('#dash-retry', body).addEventListener('click', load);
    }
  };
  $('#filter-branch', container)?.addEventListener('change', load);
  body.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-receive]')) return;
    const { receiveStockDialog } = await import('./stock.js');
    receiveStockDialog({ onSaved: load });
  });
  await load();
}
export { render_ as render };

function quickActions(d) {
  const pharmacist = session.user.role === 'pharmacist';
  const actions = [
    canSell() && html`<a class="btn btn-primary btn-lg" href="#/pos">${icon('shopping-cart')}New sale</a>`,
    pharmacist && d.prescriptions.pending && html`<a class="btn btn-lg" href="#/prescriptions?status=pending">${icon('clipboard-list')}Check prescriptions <span class="pill pill-warn no-dot">${d.prescriptions.pending}</span></a>`,
    html`<a class="btn btn-lg" href="#/prescriptions?new=1">${icon('plus')}Record a prescription</a>`,
    can(...ROLES.DISPENSING) && html`<button class="btn btn-lg" type="button" data-receive>${icon('package-plus')}Receive delivery</button>`,
    html`<a class="btn btn-lg" href="#/stock">${icon('search')}Look up a medicine</a>`,
  ].filter(Boolean);
  return html`<div class="quick-actions">${actions}</div>`;
}

/** One list of what needs doing, most urgent first: expired, expiring soon, then running low. */
function attentionList(alerts, d) {
  const owner = !session.user.branch_id;
  const where = (x) => (owner ? ` · ${x.branch_name}` : '');
  const rows = [
    ...alerts.expired.map((b) => ({ id: b.medicine_id, title: `${b.generic_name} ${b.strength}`, sub: `${num(b.qty_on_hand)} units expired · lot ${b.batch_no}${where(b)}`, badge: html`<span class="pill pill-danger">Remove from shelf</span>` })),
    ...alerts.near_expiry.map((b) => ({ id: b.medicine_id, title: `${b.generic_name} ${b.strength}`, sub: `${num(b.qty_on_hand)} units · lot ${b.batch_no}${where(b)}`, badge: expiryPill(b.expiry_date, b.days_to_expiry) })),
    ...alerts.low_stock.map((m) => ({ id: m.medicine_id, title: `${m.generic_name} ${m.strength}`, sub: `${m.stock_on_hand ? `${num(m.stock_on_hand)} left` : 'None left'}${where(m)}`, badge: html`<span class="pill ${m.stock_on_hand ? 'pill-warn' : 'pill-danger'}">${m.stock_on_hand ? 'Running low' : 'Out of stock'}</span>` })),
  ];
  const licenses = (d.license_alerts ?? []).map((p) => html`
    <div class="callout ${p.license_days_left < 0 ? 'callout-danger' : 'callout-warn'}" style="margin:var(--space-3) var(--space-5)">${icon('triangle-alert')}
      <span>${p.full_name}'s PRC license (${p.license_no}) ${p.license_days_left < 0 ? `expired on ${date(p.license_expiry)}` : `expires in ${p.license_days_left} days`}. Update it in Settings.</span></div>`);
  const shown = rows.slice(0, 8);
  return html`<section class="panel" aria-labelledby="attention-title">
    <div class="panel-header">
      <div><h2 id="attention-title">Needs attention</h2><p class="small subtle">Expired stock first, then what expires within ${d.near_expiry_days} days, then what is running low.</p></div>
      ${rows.length ? html`<a class="btn btn-sm" href="#/stock?stock=expired">See all</a>` : ''}
    </div>
    ${licenses}
    ${shown.length ? html`<div class="alert-list">${shown.map((r) => html`<a class="alert-item" href="#/stock/${r.id}">
        <span><strong>${r.title}</strong><span class="secondary-line small subtle">${r.sub}</span></span>${r.badge}</a>`)}
      ${rows.length > shown.length ? html`<p class="small subtle" style="padding:var(--space-3) var(--space-5)">and ${rows.length - shown.length} more on Medicines & Stock.</p>` : ''}</div>`
      : html`<div class="state">${icon('circle-check')}<p>All good. Nothing is expired, expiring soon, or running low.</p></div>`}
  </section>`;
}

function draw(body, d, alerts) {
  const attention = alerts.expired.length + alerts.near_expiry.length + alerts.low_stock.length;
  render(body, html`
    <section class="stack">
      ${quickActions(d)}
      <div class="stats">
        <a class="stat stat-primary" href="#/sales">
          <span class="label">Sales today</span>
          <span class="value">${money(d.today.revenue)}</span>
          <span class="meta">${num(d.today.transactions)} sale${Number(d.today.transactions) === 1 ? '' : 's'} · yesterday ${money(d.yesterday.revenue)}</span>
        </a>
        <a class="stat" href="#/prescriptions?status=pending">
          <span class="label">Prescriptions to check</span>
          <span class="value ${d.prescriptions.pending ? 'warn' : ''}">${num(d.prescriptions.pending)}</span>
          <span class="meta">${num(d.prescriptions.ready)} checked and ready to give out</span>
        </a>
        <a class="stat" href="#/stock?stock=expired">
          <span class="label">Needs attention</span>
          <span class="value ${alerts.expired.length ? 'danger' : attention ? 'warn' : ''}">${num(attention)}</span>
          <span class="meta">${num(alerts.expired.length)} expired · ${num(alerts.near_expiry.length)} expiring · ${num(alerts.low_stock.length)} low</span>
        </a>
      </div>

      <div class="grid-main-side">
        ${attentionList(alerts, d)}
        <section class="panel" aria-labelledby="top-title">
          <div class="panel-header"><h2 id="top-title">Best sellers this week</h2></div>
          <div class="panel-body">
            ${d.top_medicines.length ? html`<div class="rank">
              ${d.top_medicines.map((m) => html`<div class="rank-row">
                <span class="truncate"><strong>${medicineName(m)}</strong> <span class="subtle">${m.brand}</span></span>
                <span class="num small">${num(m.quantity)} sold</span>
                <div class="rank-track" aria-hidden="true"><div class="rank-fill" style="width:${(m.quantity / d.top_medicines[0].quantity) * 100}%"></div></div>
              </div>`)}</div>`
              : html`<div class="state"><p>No sales in the last 7 days.</p></div>`}
          </div>
        </section>
      </div>

      <div class="grid-2">
        <section class="panel" aria-labelledby="recent-title">
          <div class="panel-header"><h2 id="recent-title">Latest sales</h2><a class="btn btn-sm" href="#/sales">See all</a></div>
          ${d.recent_sales.length ? html`<div>${d.recent_sales.map((s) => html`
            <a class="list-row" href="#/sales/${s.sale_id}">
              <span><span class="mono">${s.receipt_no}</span><span class="secondary-line small subtle">${s.customer_name ?? 'Walk-in'} · ${PAYMENT_LABELS[s.payment_method]} · ${shortDate(s.created_at)} ${time(s.created_at)}</span></span>
              <span class="row"><span class="num">${money(s.total)}</span>${s.status === 'voided' ? statusPill('voided') : ''}</span>
            </a>`)}</div>` : html`<div class="state"><p>No sales recorded yet.</p></div>`}
        </section>
        <section class="panel" aria-labelledby="pay-title">
          <div class="panel-header"><h2 id="pay-title">Today's money by payment</h2></div>
          <div class="panel-body stack">
            ${['cash', 'gcash', 'card'].map((k) => html`<div class="row-between"><span>${PAYMENT_LABELS[k]}</span><span class="num">${money(d.today[k])}</span></div>`)}
            <div class="row-between" style="border-top:1px solid var(--border);padding-top:var(--space-2)"><strong>Total</strong><strong class="num">${money(d.today.revenue)}</strong></div>
          </div>
        </section>
      </div>

      ${d.branches ? html`
      <section class="panel" aria-labelledby="branches-title">
        <div class="panel-header"><h2 id="branches-title">Branches today</h2></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Branch</th><th scope="col" class="num">Sales today</th><th scope="col" class="num">Number of sales</th></tr></thead>
          <tbody>${d.branches.map((b) => html`<tr><td class="primary-cell">${b.name}</td><td class="num">${money(b.today_revenue)}</td><td class="num">${num(b.today_transactions)}</td></tr>`)}</tbody>
        </table></div>
      </section>` : ''}
    </section>`);
}
