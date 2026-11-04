import { html, render as draw, $ } from '../dom.js';
import { icon } from '../icons.js';
import { money, dateTime, statusPill, PAYMENT_LABELS, DISCOUNT_LABELS, today, daysFromToday } from '../format.js';
import { can, ROLES, session } from '../session.js';
import { createList } from '../ui/list.js';
import { pageHeader, branchFilter } from './shared.js';
import { openReceipt } from './receipt.js';

export async function render(container, { id }) {
  const isCashier = session.user.role === 'cashier';
  draw(container, html`
    ${pageHeader('Sales', isCashier ? 'Sales you rang up. Open a sale to reprint its receipt.' : 'Every completed and voided sale. Open a sale to reprint or void it.',
      can(...ROLES.SELLING) ? html`<a class="btn btn-primary" href="#/pos">${icon('shopping-cart')}New sale</a>` : '')}
    <section class="panel" aria-label="Sales list">
      <div id="sales-summary" class="panel-header" aria-live="polite"><span class="small muted">Loading totals</span></div>
      <div id="sales-list"></div>
    </section>`);

  const list = createList($('#sales-list', container), {
    endpoint: '/sales',
    caption: 'Sales',
    params: { from: daysFromToday(-6), to: today() },
    toolbar: html`
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="sales-q">Search sales</label>
        <input class="input" id="sales-q" type="search" name="q" data-filter placeholder="Receipt no., customer, or payment reference"></div>
      <label class="sr-only" for="sales-from">From</label><input class="input" id="sales-from" type="date" name="from" data-filter value="${daysFromToday(-6)}" max="${today()}">
      <label class="sr-only" for="sales-to">To</label><input class="input" id="sales-to" type="date" name="to" data-filter value="${today()}" max="${today()}">
      <label class="sr-only" for="sales-payment">Payment</label>
      <select class="select" id="sales-payment" name="payment" data-filter><option value="">Any payment</option><option value="cash">Cash</option><option value="gcash">GCash</option><option value="card">Card</option></select>
      <label class="sr-only" for="sales-status">Status</label>
      <select class="select" id="sales-status" name="status" data-filter><option value="">Any status</option><option value="completed">Completed</option><option value="voided">Voided</option></select>
      ${await branchFilter()}`,
    columns: [
      { label: 'Receipt', sortKey: 'receipt_no', render: (s) => html`<span class="mono">${s.receipt_no}</span><span class="secondary-line">${dateTime(s.created_at)}</span>` },
      { label: 'Customer', render: (s) => html`${s.customer_name ?? html`<span class="subtle">Walk-in</span>`}${s.discount_type !== 'none' ? html`<span class="secondary-line">${DISCOUNT_LABELS[s.discount_type]} discount</span>` : ''}` },
      ...(session.user.role === 'admin' ? [{ label: 'Branch', key: 'branch_name' }] : []),
      { label: 'Cashier', key: 'cashier_name' },
      { label: 'Payment', render: (s) => PAYMENT_LABELS[s.payment_method] },
      { label: 'Items', num: true, render: (s) => s.item_count },
      { label: 'Total', num: true, sortKey: 'total', render: (s) => money(s.total) },
      { label: 'Status', render: (s) => statusPill(s.status) },
    ],
    rowKey: (s) => s.sale_id,
    onRowClick: (saleId) => openReceipt(saleId, { onVoid: () => list.reload() }),
    onLoad: (res) => draw($('#sales-summary', container), html`
      <span class="small muted">${res.meta.total} sale(s) match</span>
      <span><span class="small muted">Completed sales total </span><strong class="num">${money(res.meta.revenue)}</strong></span>`),
    empty: { icon: 'receipt', title: 'No sales in this period', message: 'Completed sales appear here as soon as they are rung up.' },
  });

  if (id) openReceipt(id, { onVoid: () => list.reload() });
}
