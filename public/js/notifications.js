// The bell in the top bar. The list is built by the server from existing data (GET /notifications);
// which items this person has already seen is remembered in the browser, by notification id.
import { html, render, $ } from './dom.js';
import { icon } from './icons.js';
import { ago } from './format.js';
import { session } from './session.js';
import { toast } from './ui/toast.js';

const SEVERITY_ICON = { danger: 'circle-alert', warn: 'triangle-alert', info: 'info' };
// Someone is waiting at the counter for these, so they also pop up as a toast (and a desktop alert when the tab is hidden).
const URGENT = new Set(['rx_pending', 'rx_reviewed']);
const MAX_REMEMBERED = 300;

let items = [];
let previousIds = null;
const storeKey = () => `pms.notif.seen.${session.user.user_id}`;

function seenIds() {
  try { return new Set(JSON.parse(localStorage.getItem(storeKey()) ?? '[]')); } catch { return new Set(); }
}
function markAllSeen() {
  const seen = [...new Set([...items.map((n) => n.id), ...seenIds()])].slice(0, MAX_REMEMBERED);
  try { localStorage.setItem(storeKey(), JSON.stringify(seen)); } catch { /* Storage full or blocked: unread counts just reset. */ }
}
const unread = () => {
  const seen = seenIds();
  return items.filter((n) => !seen.has(n.id));
};

function drawButton() {
  const slot = $('#notif-btn-wrap');
  if (!slot) return;
  const count = unread().length;
  const open = Boolean($('#notif-panel'));
  render(slot, html`<button class="btn btn-ghost btn-icon notif-btn" type="button" id="notif-btn" aria-haspopup="dialog" aria-expanded="${open}"
      aria-label="${count ? `Notifications, ${count} new` : 'Notifications'}">
      ${icon('bell')}${count ? html`<span class="notif-count" aria-hidden="true">${count > 99 ? '99+' : count}</span>` : ''}</button>`);
}

function panelBody() {
  const seen = seenIds();
  const askDesktop = 'Notification' in window && Notification.permission === 'default';
  return html`
    <div class="notif-head">
      <strong>Notifications</strong>
      ${items.length ? html`<button class="btn btn-ghost btn-sm" type="button" data-mark-read>Mark all as read</button>` : ''}
    </div>
    ${items.length ? html`<div class="notif-list">${items.map((n) => html`
      <a class="notif-item notif-${n.severity} ${seen.has(n.id) ? '' : 'is-new'}" href="${n.link}">
        ${icon(SEVERITY_ICON[n.severity] ?? 'info')}
        <span class="notif-text"><span class="notif-title">${n.title}</span><span class="notif-body">${n.body}</span></span>
        <span class="notif-time">${ago(n.at)}</span>
      </a>`)}</div>`
      : html`<div class="state">${icon('circle-check')}<p>You're all caught up.</p></div>`}
    ${askDesktop ? html`<div class="notif-foot"><button class="btn btn-sm btn-block" type="button" data-desktop>${icon('bell', 'icon-sm')}Turn on desktop alerts for prescriptions</button></div>` : ''}`;
}

function closePanel() {
  $('#notif-panel')?.remove();
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('keydown', onKey);
  drawButton();
}
function outside(e) {
  if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-btn')) closePanel();
}
function onKey(e) {
  if (e.key === 'Escape') { closePanel(); $('#notif-btn')?.focus(); }
}

function openPanel() {
  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.className = 'popover notif-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Notifications');
  render(panel, panelBody());
  $('#notif-slot').append(panel);
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', onKey);
  panel.addEventListener('click', async (e) => {
    if (e.target.closest('[data-mark-read]')) { markAllSeen(); render(panel, panelBody()); drawButton(); return; }
    if (e.target.closest('[data-desktop]')) {
      await Notification.requestPermission().catch(() => {});
      render(panel, panelBody());
      return;
    }
    if (e.target.closest('a')) { markAllSeen(); closePanel(); }
  });
  // Opening the list counts as seeing what is in it; the "new" highlight stays until it is closed.
  markAllSeen();
  drawButton();
  panel.querySelector('a, button')?.focus();
}

function announce(fresh) {
  for (const n of fresh) {
    toast(html`<a href="${n.link}"><strong>${n.title}</strong></a><br><span class="small">${n.body}</span>`, { type: 'info', duration: 8000 });
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      const note = new Notification(n.title, { body: n.body, tag: n.id, icon: '/icons/favicon.svg' });
      note.onclick = () => { window.focus(); location.hash = n.link; note.close(); };
    }
  }
}

/** Called with each fresh list from the server. Urgent items that appeared since the last check are announced. */
export function updateNotifications(list) {
  items = list;
  const ids = new Set(items.map((n) => n.id));
  if (previousIds) {
    const seen = seenIds();
    announce(items.filter((n) => URGENT.has(n.type) && !previousIds.has(n.id) && !seen.has(n.id)));
  }
  previousIds = ids;
  const panel = $('#notif-panel');
  if (panel) render(panel, panelBody());
  drawButton();
}

export function mountBell() {
  const slot = $('#notif-slot');
  if (!slot) return;
  // The button is redrawn on every update; the panel sits beside it so redrawing never closes it.
  render(slot, html`<span id="notif-btn-wrap"></span>`);
  drawButton();
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#notif-btn')) return;
    if ($('#notif-panel')) closePanel();
    else openPanel();
  });
}
