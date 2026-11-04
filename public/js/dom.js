// Tagged-template HTML with automatic escaping. Interpolated values are escaped unless wrapped in raw()
// or produced by another html`` call, so database text can never inject markup.
class SafeHtml {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = (v) => String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]);

const stringify = (v) => {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(stringify).join('');
  return escape(v);
};

export function html(strings, ...values) {
  return new SafeHtml(strings.reduce((out, s, i) => out + s + (i < values.length ? stringify(values[i]) : ''), ''));
}

export const raw = (s) => new SafeHtml(s);

export function render(el, content) {
  el.innerHTML = stringify(content);
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Delegated event listener: handler runs when the event target matches selector inside root. */
export function on(root, event, selector, handler, options) {
  const listener = (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  };
  root.addEventListener(event, listener, options);
  return () => root.removeEventListener(event, listener, options);
}

export const debounce = (fn, ms = 250) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};
