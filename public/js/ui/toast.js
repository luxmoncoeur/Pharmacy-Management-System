import { html, render } from '../dom.js';
import { icon } from '../icons.js';

const region = () => {
  let el = document.getElementById('toasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toasts';
    el.className = 'toasts';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.append(el);
  }
  return el;
};

/** Shows a toast. The dismiss timer pauses while the tab is hidden or the toast is hovered. */
export function toast(message, { type = 'success', duration } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  if (type === 'error') el.setAttribute('role', 'alert');
  render(el, html`
    ${icon(type === 'error' ? 'circle-alert' : type === 'info' ? 'info' : 'circle-check')}
    <div class="toast-body">${message}</div>
    <button class="btn btn-ghost btn-icon btn-sm toast-close" type="button" aria-label="Dismiss">${icon('x', 'icon-sm')}</button>`);
  region().append(el);

  let remaining = duration ?? (type === 'error' ? 7000 : 4000);
  let started = Date.now();
  let timer;
  const close = () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 170);
  };
  const pause = () => { clearTimeout(timer); remaining -= Date.now() - started; };
  const resume = () => { started = Date.now(); timer = setTimeout(close, Math.max(remaining, 1200)); };
  const onVisibility = () => (document.hidden ? pause() : resume());

  el.querySelector('.toast-close').addEventListener('click', close);
  el.addEventListener('pointerenter', pause);
  el.addEventListener('pointerleave', resume);
  document.addEventListener('visibilitychange', onVisibility);
  resume();
}

export const toastError = (err) => toast(err?.message || 'Something went wrong.', { type: 'error' });
