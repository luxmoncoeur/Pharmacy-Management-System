import { html, render as draw, $ } from '../dom.js';
import { dateTime, today, daysFromToday } from '../format.js';
import { createList } from '../ui/list.js';
import { pageHeader } from './shared.js';

const ACTIONS = ['login', 'login_failed', 'create', 'update', 'deactivate', 'delete', 'price_change', 'sale', 'void', 'receive_stock', 'adjust', 'write_off', 'verify', 'reject', 'dispatch', 'receive', 'cancel', 'password_change'];
const label = (a) => a.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function describe(row) {
  if (!row.details) return '';
  try {
    const d = JSON.parse(row.details);
    return Object.entries(d).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ');
  } catch { return row.details; }
}

export async function render(container) {
  draw(container, html`
    ${pageHeader('Audit log', 'Sign-ins, price changes, voids, stock adjustments and other sensitive actions, with who did them.')}
    <section class="panel" id="audit-list"></section>`);
  createList($('#audit-list', container), {
    endpoint: '/audit-log',
    caption: 'Audit log',
    limit: 50,
    params: { from: daysFromToday(-6), to: today() },
    toolbar: html`
      <label class="sr-only" for="a-action">Action</label>
      <select class="select" id="a-action" name="action" data-filter><option value="">All actions</option>${ACTIONS.map((a) => html`<option value="${a}">${label(a)}</option>`)}</select>
      <label class="sr-only" for="a-entity">Record type</label>
      <select class="select" id="a-entity" name="entity" data-filter><option value="">All records</option>
        ${['sale', 'batch', 'medicine', 'prescription', 'transfer', 'customer', 'user', 'pharmacist', 'supplier', 'branch', 'category'].map((e) => html`<option value="${e}">${label(e)}</option>`)}</select>
      <label class="sr-only" for="a-from">From</label><input class="input" id="a-from" type="date" name="from" data-filter value="${daysFromToday(-6)}" max="${today()}">
      <label class="sr-only" for="a-to">To</label><input class="input" id="a-to" type="date" name="to" data-filter value="${today()}" max="${today()}">`,
    columns: [
      { label: 'When', render: (r) => html`<span class="nowrap">${dateTime(r.created_at)}</span>` },
      { label: 'Who', render: (r) => (r.user_name ? html`${r.user_name}<span class="secondary-line mono">${r.username}</span>` : html`<span class="subtle">Unknown</span>`) },
      { label: 'Action', render: (r) => html`<span class="${r.action === 'login_failed' || r.action === 'void' ? 'pill pill-warn no-dot' : ''}">${label(r.action)}</span>` },
      { label: 'Record', render: (r) => `${label(r.entity)}${r.entity_id ? ` #${r.entity_id}` : ''}` },
      { label: 'Details', render: (r) => html`<span class="small muted">${describe(r)}</span>` },
      { label: 'IP address', render: (r) => html`<span class="mono">${r.ip ?? ''}</span>` },
    ],
    empty: { icon: 'shield-check', title: 'No activity in this period', message: 'Actions appear here as staff use the system.' },
  });
}
