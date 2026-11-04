import { api } from '../api.js';
import { html, render, $, on, debounce } from '../dom.js';
import { icon } from '../icons.js';
import { num } from '../format.js';

/**
 * A server-backed table: toolbar filters, sortable headers, pagination, and loading / empty / error states.
 * Filters are any element in the toolbar with a [data-filter] attribute; its name is the query key.
 */
export function createList(mount, {
  endpoint, columns, toolbar = '', params = {}, limit = 25, onRowClick, rowKey, empty, caption, onLoad, transform,
}) {
  const state = { page: 1, limit, sort: params.sort, dir: params.dir ?? 'asc', ...params };
  let requestId = 0;

  render(mount, html`
    ${toolbar ? html`<div class="toolbar" role="search">${toolbar}</div>` : ''}
    <div class="table-wrap" data-body></div>
    <div data-pagination></div>`);
  const body = $('[data-body]', mount);
  const pager = $('[data-pagination]', mount);

  const readFilters = () => {
    mount.querySelectorAll('[data-filter]').forEach((el) => {
      state[el.name] = el.type === 'checkbox' ? (el.checked ? el.value || 'true' : '') : el.value.trim();
    });
  };

  const head = () => html`<thead><tr>${columns.map((c) => {
    if (!c.sortKey) return html`<th scope="col" class="${c.num ? 'num' : ''}">${c.label}</th>`;
    const active = state.sort === c.sortKey;
    const ariaSort = active ? (state.dir === 'asc' ? 'ascending' : 'descending') : null;
    return html`<th scope="col" class="${c.num ? 'num' : ''}" ${ariaSort ? html`aria-sort="${ariaSort}"` : ''}>
      <button class="sort" type="button" data-sort="${c.sortKey}">${c.label}${icon('arrow-down-up', 'icon-sm')}</button></th>`;
  })}</tr></thead>`;

  const skeleton = () => html`<table class="table">${caption ? html`<caption class="sr-only">${caption}</caption>` : ''}${head()}<tbody>
    ${Array.from({ length: 6 }, () => html`<tr class="skeleton-row">${columns.map(() => html`<td><span class="skeleton" style="width:${40 + Math.round(Math.random() * 45)}%"></span></td>`)}</tr>`)}
  </tbody></table>`;

  async function load() {
    readFilters();
    const id = ++requestId;
    mount.setAttribute('aria-busy', 'true');
    render(body, skeleton());
    try {
      const query = Object.fromEntries(Object.entries(state).filter(([, v]) => v !== undefined && v !== ''));
      const res = await api.get(endpoint, query);
      if (id !== requestId) return;
      const rows = transform ? transform(res.data) : res.data;
      onLoad?.(res);
      if (!rows.length) {
        const filtered = Object.entries(state).some(([k, v]) => !['page', 'limit', 'sort', 'dir', ...Object.keys(params)].includes(k) && v);
        render(body, html`<div class="state">
          ${icon(filtered ? 'search' : empty?.icon ?? 'archive')}
          <h3>${filtered ? 'No matches' : empty?.title ?? 'Nothing here yet'}</h3>
          <p>${filtered ? 'Try a different search or clear the filters.' : empty?.message ?? ''}</p>
          ${!filtered && empty?.action ? empty.action : ''}
        </div>`);
        render(pager, '');
        return;
      }
      render(body, html`<table class="table">${caption ? html`<caption class="sr-only">${caption}</caption>` : ''}${head()}<tbody>
        ${rows.map((r) => html`<tr ${onRowClick ? html`data-href="${rowKey(r)}" tabindex="0"` : ''}>
          ${columns.map((c) => html`<td class="${c.num ? 'num' : ''} ${c.className ?? ''}">${c.render ? c.render(r) : r[c.key] ?? ''}</td>`)}
        </tr>`)}
      </tbody></table>`);
      const meta = res.meta;
      if (meta?.pages) {
        const from = (meta.page - 1) * meta.limit + 1;
        const to = Math.min(meta.page * meta.limit, meta.total);
        render(pager, html`<nav class="pagination" aria-label="Pagination">
          <span>${num(from)}–${num(to)} of ${num(meta.total)}</span>
          <div class="pages">
            <button class="btn btn-sm" type="button" data-page="${meta.page - 1}" ${meta.page <= 1 ? 'disabled' : ''}>${icon('chevron-left', 'icon-sm')}Previous</button>
            <span>Page ${meta.page} of ${meta.pages}</span>
            <button class="btn btn-sm" type="button" data-page="${meta.page + 1}" ${meta.page >= meta.pages ? 'disabled' : ''}>Next${icon('chevron-right', 'icon-sm')}</button>
          </div>
        </nav>`);
      } else render(pager, '');
    } catch (err) {
      if (id !== requestId) return;
      render(body, html`<div class="state state-error" role="alert">
        ${icon('circle-alert')}<h3>Could not load this list</h3><p>${err.message}</p>
        <button class="btn" type="button" data-retry>${icon('refresh-cw', 'icon-sm')}Try again</button></div>`);
      render(pager, '');
    } finally {
      if (id === requestId) mount.removeAttribute('aria-busy');
    }
  }

  const refilter = () => { state.page = 1; load(); };
  on(mount, 'input', 'input[data-filter][type="search"]', debounce(refilter, 250));
  on(mount, 'change', 'select[data-filter], input[data-filter]:not([type="search"])', refilter);
  on(mount, 'click', '[data-page]', (_e, btn) => { state.page = Number(btn.dataset.page); load(); mount.scrollIntoView({ block: 'nearest' }); });
  on(mount, 'click', '[data-retry]', () => load());
  on(mount, 'click', '[data-sort]', (_e, btn) => {
    const key = btn.dataset.sort;
    state.dir = state.sort === key && state.dir === 'asc' ? 'desc' : 'asc';
    state.sort = key;
    load();
  });
  if (onRowClick) {
    const open = (tr) => onRowClick(tr.dataset.href);
    on(mount, 'click', 'tr[data-href]', (e, tr) => { if (!e.target.closest('button, a, input, select')) open(tr); });
    on(mount, 'keydown', 'tr[data-href]', (e, tr) => { if (e.key === 'Enter' && e.target === tr) open(tr); });
  }

  load();
  return { reload: load, state, setParam: (k, v) => { state[k] = v; state.page = 1; load(); } };
}
