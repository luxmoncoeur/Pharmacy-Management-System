import { api } from './api.js';
import { html, render, $, on } from './dom.js';
import { icon } from './icons.js';
import { session, loadSession, can, ROLES } from './session.js';
import { route, resolve, onRouteChange } from './router.js';
import { initials, ROLE_LABELS } from './format.js';
import { getThemePref, setThemePref } from './theme.js';
import { toastError } from './ui/toast.js';

// Each entry: route name, label, icon, roles that see it, lazy view module.
const NAV = [
  { items: [
    ['dashboard', 'Dashboard', 'layout-dashboard', ROLES.ALL, () => import('./views/dashboard.js')],
  ] },
  { group: 'Counter', items: [
    ['pos', 'Point of sale', 'shopping-cart', ROLES.SELLING, () => import('./views/pos.js')],
    ['sales', 'Sales', 'receipt', ROLES.ALL, () => import('./views/sales.js')],
    ['prescriptions', 'Prescriptions', 'clipboard-list', ROLES.DISPENSING, () => import('./views/prescriptions.js')],
    ['customers', 'Customers', 'users', ROLES.ALL, () => import('./views/customers.js')],
  ] },
  { group: 'Stock', items: [
    ['medicines', 'Medicines', 'pill', ROLES.ALL, () => import('./views/medicines.js')],
    ['inventory', 'Inventory', 'package', ROLES.DISPENSING, () => import('./views/inventory.js')],
    ['transfers', 'Transfers', 'arrow-left-right', ROLES.MANAGEMENT, () => import('./views/transfers.js')],
    ['suppliers', 'Suppliers', 'truck', ROLES.MANAGEMENT, () => import('./views/suppliers.js')],
  ] },
  { group: 'Management', items: [
    ['reports', 'Reports', 'chart-column', ROLES.MANAGEMENT, () => import('./views/reports.js')],
    ['users', 'Staff accounts', 'user', ROLES.MANAGEMENT, () => import('./views/users.js')],
    ['pharmacists', 'Pharmacists', 'stethoscope', ROLES.MANAGEMENT, () => import('./views/pharmacists.js')],
    ['branches', 'Branches', 'building-2', ['admin'], () => import('./views/branches.js')],
    ['audit', 'Audit log', 'shield-check', ['admin'], () => import('./views/audit.js')],
  ] },
];

const LABELS = Object.fromEntries(NAV.flatMap((g) => g.items.map(([name, label]) => [name, label])));
LABELS.account = 'Your account';

function renderSidebar(badges = {}) {
  const u = session.user;
  render($('#sidebar'), html`
    <div class="brand">
      <span class="brand-mark">${icon('pill')}</span>
      <div class="truncate">
        <div class="brand-name">Pharmacy</div>
        <div class="brand-branch truncate">${u.branch_name ?? 'All branches'}</div>
      </div>
    </div>
    <nav class="nav" aria-label="Sections">
      ${NAV.map((g) => {
        const items = g.items.filter(([, , , roles]) => roles.includes(u.role));
        if (!items.length) return '';
        return html`${g.group ? html`<div class="nav-group">${g.group}</div>` : ''}
          ${items.map(([name, label, ic]) => html`<a href="#/${name}" data-nav="${name}">${icon(ic)}<span>${label}</span>
            ${badges[name] ? html`<span class="count" aria-label="${badges[name]} need attention">${badges[name]}</span>` : ''}</a>`)}`;
      })}
    </nav>
    <div class="sidebar-footer">
      <button class="user-chip" type="button" id="user-menu-btn" aria-haspopup="menu" aria-expanded="false">
        <span class="avatar" aria-hidden="true">${initials(u.full_name)}</span>
        <span class="truncate"><span class="name truncate">${u.full_name}</span><span class="role">${ROLE_LABELS[u.role]}</span></span>
      </button>
    </div>`);
  markActive();
}

function markActive() {
  const name = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function openUserMenu(btn) {
  const existing = $('#user-menu');
  if (existing) return existing.remove();
  const pref = getThemePref();
  const menu = document.createElement('div');
  menu.id = 'user-menu';
  menu.className = 'popover';
  menu.setAttribute('role', 'menu');
  menu.style.cssText = 'left: 0.75rem; right: 0.75rem; bottom: 4.25rem; transform-origin: bottom center;';
  render(menu, html`
    <a class="menu-item" role="menuitem" href="#/account">${icon('key-round')}Account and password</a>
    <div class="menu-sep" role="separator"></div>
    <div class="nav-group" style="margin-top:0.25rem">Appearance</div>
    ${[['system', 'Match system', 'sliders-horizontal'], ['light', 'Light', 'sun'], ['dark', 'Dark', 'moon']].map(([v, l, ic]) => html`
      <button class="menu-item" role="menuitemradio" aria-checked="${pref === v}" type="button" data-theme-pref="${v}">
        ${icon(ic)}<span style="flex:1">${l}</span>${pref === v ? icon('check', 'icon-sm') : ''}</button>`)}
    <div class="menu-sep" role="separator"></div>
    <button class="menu-item" role="menuitem" type="button" data-signout>${icon('log-out')}Sign out</button>`);
  $('#sidebar .sidebar-footer').style.position = 'relative';
  $('#sidebar').append(menu);
  btn.setAttribute('aria-expanded', 'true');
  menu.querySelector('.menu-item').focus();

  const close = () => { menu.remove(); btn.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', outside); };
  const outside = (e) => { if (!menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close(); };
  document.addEventListener('pointerdown', outside);
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('.menu-item')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { close(); btn.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  menu.addEventListener('click', async (e) => {
    const theme = e.target.closest('[data-theme-pref]');
    if (theme) { setThemePref(theme.dataset.themePref); close(); return; }
    if (e.target.closest('[data-signout]')) {
      await api.post('/auth/logout').catch(() => {});
      location.replace('/login');
    }
    if (e.target.closest('a')) close();
  });
}

/** Sidebar counts: items that need someone's action. Refreshed after each navigation. */
export async function refreshBadges() {
  const badges = {};
  try {
    if (can(...ROLES.DISPENSING)) {
      const [rx, alerts] = await Promise.all([
        api.get('/prescriptions', { status: 'pending', limit: 1 }),
        api.get('/inventory/alerts'),
      ]);
      badges.prescriptions = rx.meta.total || 0;
      badges.inventory = alerts.data.expired.length + alerts.data.near_expiry.length + alerts.data.low_stock.length || 0;
    }
    if (can(...ROLES.MANAGEMENT)) {
      const dash = await api.get('/dashboard');
      badges.transfers = dash.data.transfers.to_dispatch + dash.data.transfers.to_receive || 0;
    }
  } catch { /* Badges are a convenience; the pages themselves show the real state. */ }
  renderSidebar(badges);
}

function setNavOpen(open) {
  $('#app').dataset.navOpen = String(open);
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('.nav-scrim')?.remove();
  if (open) {
    const scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    scrim.addEventListener('click', () => setNavOpen(false));
    $('#app').append(scrim);
  }
}

async function start() {
  try {
    await loadSession();
  } catch (err) {
    if (err.status !== 401) toastError(err);
    return;
  }

  for (const group of NAV) {
    for (const [name, , , roles, loader] of group.items) route(name, loader, { allowed: () => roles.includes(session.user.role) });
  }
  route('account', () => import('./views/account.js'));

  renderSidebar();
  refreshBadges();

  on(document, 'click', '#user-menu-btn', (_e, btn) => openUserMenu(btn));
  $('#menu-toggle').addEventListener('click', () => setNavOpen($('#app').dataset.navOpen !== 'true'));

  onRouteChange((name) => {
    $('#crumb').textContent = LABELS[name] ?? '';
    document.title = `${LABELS[name] ?? 'Pharmacy'} · Pharmacy Management System`;
    render($('#topbar-actions'), '');
    markActive();
    setNavOpen(false);
  });

  window.addEventListener('hashchange', () => refreshBadges());
  window.addEventListener('pms:data-changed', () => refreshBadges());

  if (!location.hash) location.replace(session.user.role === 'cashier' ? '#/pos' : '#/dashboard');
  resolve(session.user.role === 'cashier' ? 'pos' : 'dashboard');
}

start();
