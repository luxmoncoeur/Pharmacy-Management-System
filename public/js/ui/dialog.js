import { html, render } from '../dom.js';
import { icon } from '../icons.js';

/**
 * Opens a native modal <dialog>. Returns { el, body, close, closed } where `closed` resolves on close.
 * Native dialogs give focus trapping, Escape to close, and inert background for free.
 */
export function openDialog({ title, description, body, footer, size = '', className = '', onClose } = {}) {
  const el = document.createElement('dialog');
  el.className = `dialog ${size} ${className}`;
  el.setAttribute('aria-labelledby', 'dialog-title');
  render(el, html`
    <div class="dialog-header">
      <div><h2 id="dialog-title">${title}</h2>${description ? html`<p>${description}</p>` : ''}</div>
      <button class="btn btn-ghost btn-icon btn-sm" type="button" data-close aria-label="Close">${icon('x')}</button>
    </div>
    <div class="dialog-body">${body ?? ''}</div>
    ${footer ? html`<div class="dialog-footer">${footer}</div>` : ''}`);
  document.body.append(el);

  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  const close = (value) => { el.returnValue = value ?? ''; el.close(); };

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    // Click on the backdrop (the dialog element itself, outside its content box) closes it.
    else if (e.target === el) {
      const r = el.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) close();
    }
  });
  el.addEventListener('close', () => {
    onClose?.(el.returnValue);
    resolveClosed(el.returnValue);
    setTimeout(() => el.remove(), 200);
  }, { once: true });

  el.showModal();
  const autofocus = el.querySelector('[autofocus]') ?? el.querySelector('.dialog-body input, .dialog-body select, .dialog-body textarea');
  autofocus?.focus();
  return { el, body: el.querySelector('.dialog-body'), close, closed };
}

/** A confirmation for destructive or irreversible actions only. Optionally collects a required reason. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, reasonLabel, onConfirm }) {
  return new Promise((resolve) => {
    const { el, close } = openDialog({
      title,
      size: 'narrow',
      body: html`
        <p class="muted">${message}</p>
        ${reasonLabel ? html`
          <div class="field">
            <label for="confirm-reason">${reasonLabel}<span class="req">*</span></label>
            <textarea class="textarea" id="confirm-reason" name="reason" maxlength="255" required autofocus></textarea>
            <span class="error" id="confirm-reason-error"></span>
          </div>` : ''}
        <div class="form-error" hidden></div>`,
      footer: html`
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="button" data-confirm>${confirmLabel}</button>`,
      onClose: () => resolve(el.dataset.confirmed === 'true'),
    });
    const btn = el.querySelector('[data-confirm]');
    if (!reasonLabel) btn.focus();
    btn.addEventListener('click', async () => {
      const reason = el.querySelector('#confirm-reason')?.value.trim();
      if (reasonLabel && !reason) {
        el.querySelector('#confirm-reason').setAttribute('aria-invalid', 'true');
        el.querySelector('#confirm-reason-error').textContent = `${reasonLabel} is required.`;
        el.querySelector('#confirm-reason').focus();
        return;
      }
      btn.setAttribute('aria-busy', 'true');
      try {
        await onConfirm?.(reason);
        el.dataset.confirmed = 'true';
        close();
      } catch (err) {
        const box = el.querySelector('.form-error');
        box.hidden = false;
        box.textContent = err.message;
      } finally {
        btn.removeAttribute('aria-busy');
      }
    });
  });
}
