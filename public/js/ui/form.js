import { $$ } from '../dom.js';

/** Reads a form into a plain object. Checkboxes become booleans; number inputs become numbers; blanks stay ''. */
export function readForm(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') data[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
    else if (el.type === 'number') data[el.name] = el.value === '' ? '' : Number(el.value);
    else data[el.name] = el.value.trim();
  }
  return data;
}

export function clearErrors(form) {
  $$('[aria-invalid="true"]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  $$('.error', form).forEach((el) => { el.textContent = ''; });
  const box = form.querySelector('.form-error');
  if (box) { box.textContent = ''; box.hidden = true; }
}

/** Puts server (or client) field errors next to their inputs and focuses the first invalid one. */
export function showErrors(form, errors = {}, message) {
  clearErrors(form);
  let first = null;
  const unplaced = [];
  for (const [field, msg] of Object.entries(errors ?? {})) {
    const input = form.querySelector(`[name="${CSS.escape(field)}"]`);
    const slot = form.querySelector(`[data-error-for="${CSS.escape(field)}"]`) ?? input?.closest('.field')?.querySelector('.error');
    if (input) input.setAttribute('aria-invalid', 'true');
    if (slot) slot.textContent = msg;
    else unplaced.push(msg);
    first ??= input;
  }
  const box = form.querySelector('.form-error');
  const summary = unplaced.length ? unplaced.join(' ') : (!Object.keys(errors ?? {}).length ? message : '');
  if (box && summary) { box.textContent = summary; box.hidden = false; }
  first?.focus();
}

/** Client-side checks mirror the most common server rules so mistakes are caught before a round trip. */
export function validateRequired(form) {
  const errors = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.required && !String(el.value).trim()) {
      const label = el.closest('.field')?.querySelector('label')?.textContent.replace('*', '').trim() || 'This field';
      errors[el.name] = `${label} is required.`;
    } else if (el.type === 'email' && el.value && !el.checkValidity()) {
      errors[el.name] = 'Enter a valid email address.';
    } else if (el.type === 'number' && el.value !== '' && !el.checkValidity()) {
      errors[el.name] = el.validationMessage;
    }
  }
  return errors;
}

export async function withBusy(button, fn) {
  button?.setAttribute('aria-busy', 'true');
  if (button) button.disabled = true;
  try { return await fn(); } finally {
    button?.removeAttribute('aria-busy');
    if (button) button.disabled = false;
  }
}

/**
 * Wires a form: client validation, submit via `submit(data)`, server field errors mapped back.
 * `submit` should throw ApiError on failure. Returns nothing; success handling lives in `submit`.
 */
export function handleForm(form, submit, validate) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientErrors = { ...validateRequired(form), ...(validate?.(readForm(form)) ?? {}) };
    if (Object.keys(clientErrors).length) return showErrors(form, clientErrors);
    clearErrors(form);
    const button = form.querySelector('[type="submit"]') ?? document.querySelector(`[form="${form.id}"][type="submit"]`);
    await withBusy(button, async () => {
      try { await submit(readForm(form)); } catch (err) { showErrors(form, err.errors, err.message); }
    });
  });
}
