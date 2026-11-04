// Settings: staff accounts, and (for the owner) branches. Categories and suppliers are typed in where they are used.
import { html, render as draw, $, on } from '../dom.js';
import { isOwner } from '../session.js';

// [key, label, owner only, view module]
const TABS = [
  ['staff', 'Staff accounts', false, () => import('./users.js')],
  ['branches', 'Branches', true, () => import('./branches.js')],
];

export async function render(container, { query }) {
  const tabs = TABS.filter(([, , ownerOnly]) => !ownerOnly || isOwner());
  let active = tabs.some(([k]) => k === query?.tab) ? query.tab : tabs[0][0];

  draw(container, html`
    <div class="tabs" role="tablist" aria-label="Settings" style="margin-bottom:var(--space-5)">
      ${tabs.map(([k, l]) => html`<button type="button" role="tab" id="tab-${k}" aria-controls="settings-panel" aria-selected="${k === active}" tabindex="${k === active ? 0 : -1}" data-tab="${k}">${l}</button>`)}
    </div>
    <div id="settings-panel" role="tabpanel" aria-labelledby="tab-${active}"></div>`);

  const show = async (key) => {
    active = key;
    container.querySelectorAll('[data-tab]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.tab === key)); b.tabIndex = b.dataset.tab === key ? 0 : -1; });
    history.replaceState(null, '', `#/settings?tab=${key}`);
    // A fresh element per tab so listeners from the previous tab are discarded with it.
    const panel = document.createElement('div');
    $('#settings-panel', container).replaceChildren(panel);
    $('#settings-panel', container).setAttribute('aria-labelledby', `tab-${key}`);
    const mod = await tabs.find(([k]) => k === key)[3]();
    await mod.render(panel, {});
  };
  on(container, 'click', '[data-tab]', (_e, b) => show(b.dataset.tab));
  on(container, 'keydown', '[role="tab"]', (e, b) => {
    const all = [...container.querySelectorAll('[role="tab"]')];
    const i = all.indexOf(b);
    const next = e.key === 'ArrowRight' ? all[(i + 1) % all.length] : e.key === 'ArrowLeft' ? all[(i - 1 + all.length) % all.length] : null;
    if (next) { e.preventDefault(); next.focus(); show(next.dataset.tab); }
  });
  await show(active);
}
