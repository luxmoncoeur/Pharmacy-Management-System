import { html, render, debounce } from '../dom.js';

let uid = 0;

/**
 * Accessible async combobox (ARIA 1.2 pattern). Typing searches; arrow keys move; Enter picks; Escape closes.
 * search(q) => Promise<items>; option(item) => html; onSelect(item).
 */
export function combobox(input, { search, option, onSelect, emptyText = 'No matches', minChars = 0 }) {
  const id = `cb-${++uid}`;
  const wrap = input.closest('.combo') ?? input.parentElement;
  const list = document.createElement('div');
  list.className = 'popover';
  list.id = `${id}-list`;
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  wrap.append(list);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('autocomplete', 'off');

  let items = [];
  let active = -1;
  let seq = 0;

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const highlight = (i) => {
    active = i;
    [...list.children].forEach((el, j) => el.setAttribute('aria-selected', String(j === i)));
    const el = list.children[i];
    if (el?.id) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); }
  };
  const choose = (i) => {
    const item = items[i];
    if (!item) return;
    close();
    onSelect(item);
  };

  const run = async () => {
    const q = input.value.trim();
    if (q.length < minChars) return close();
    const mine = ++seq;
    try {
      const result = await search(q);
      if (mine !== seq) return;
      items = result;
      render(list, items.length
        ? items.map((it, i) => html`<div class="option" role="option" id="${id}-o${i}" data-i="${i}" aria-selected="false">${option(it)}</div>`)
        : html`<div class="option-empty">${emptyText}</div>`);
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      if (items.length) highlight(0);
    } catch {
      close();
    }
  };
  const debounced = debounce(run, 200);

  input.addEventListener('input', debounced);
  input.addEventListener('focus', () => { if (minChars === 0) run(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) run(); else highlight(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && !list.hidden && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); close(); }
  });
  list.addEventListener('pointerdown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => { const el = e.target.closest('[data-i]'); if (el) choose(Number(el.dataset.i)); });
  input.addEventListener('blur', () => setTimeout(close, 100));

  return { close, refresh: run };
}
