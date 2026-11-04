import { html } from '../dom.js';

/**
 * Renders labelled form fields from a definition list. Each field gets an id, a label, an error slot,
 * and aria-describedby wiring so screen readers announce hints and errors.
 * def: { name, label, type, required, hint, span, options: [[value, label]], suggestions: [text], attrs: {min, max, step, maxlength, ...} }
 * `suggestions` turns a text input into free text with a dropdown of values already in use (a native datalist).
 */
export function fields(defs, values = {}) {
  return defs.map((d) => {
    const id = `f-${d.name}`;
    const v = values[d.name] ?? d.value ?? '';
    const attrs = Object.entries(d.attrs ?? {}).map(([k, val]) => html` ${k}="${val}"`);
    const describedBy = [d.hint ? `${id}-hint` : '', `${id}-error`].filter(Boolean).join(' ');
    const common = html`id="${id}" name="${d.name}" ${d.required ? html`required aria-required="true"` : ''} aria-describedby="${describedBy}"${attrs}`;

    let control;
    if (d.type === 'select') {
      control = html`<select class="select" ${common}>
        ${d.placeholder !== undefined ? html`<option value="">${d.placeholder}</option>` : ''}
        ${d.options.map(([val, label]) => html`<option value="${val}" ${String(val) === String(v) ? 'selected' : ''}>${label}</option>`)}
      </select>`;
    } else if (d.type === 'textarea') {
      control = html`<textarea class="textarea" ${common}>${v}</textarea>`;
    } else if (d.type === 'checkbox') {
      return html`<div class="field ${d.span ? 'span-2' : ''}">
        <label class="check"><input type="checkbox" ${common} ${v === true || v === 1 ? 'checked' : ''}> ${d.label}</label>
        ${d.hint ? html`<span class="hint" id="${id}-hint">${d.hint}</span>` : ''}
        <span class="error" id="${id}-error"></span>
      </div>`;
    } else {
      control = html`<input class="input" type="${d.type ?? 'text'}" value="${v}" ${d.placeholder ? html`placeholder="${d.placeholder}"` : ''} ${d.suggestions ? html`list="${id}-list" autocomplete="off"` : ''} ${common}>
        ${d.suggestions ? html`<datalist id="${id}-list">${d.suggestions.map((s) => html`<option value="${s}"></option>`)}</datalist>` : ''}`;
    }
    return html`<div class="field ${d.span ? 'span-2' : ''}">
      <label for="${id}">${d.label}${d.required ? html`<span class="req" aria-hidden="true">*</span>` : ''}</label>
      ${control}
      ${d.hint ? html`<span class="hint" id="${id}-hint">${d.hint}</span>` : ''}
      <span class="error" id="${id}-error"></span>
    </div>`;
  });
}
