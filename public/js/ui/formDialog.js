import { api } from '../api.js';
import { html } from '../dom.js';
import { openDialog } from './dialog.js';
import { handleForm } from './form.js';
import { fields } from './fields.js';
import { toast } from './toast.js';

let n = 0;

/**
 * Create/edit dialog for a record. POSTs to `endpoint` when creating, PUTs to `endpoint/:id` when editing.
 * `prepare(data)` can reshape form values before sending (e.g. empty strings to null).
 */
export function formDialog({ title, description, defs, values = {}, endpoint, id, submitLabel, onSaved, prepare = (d) => d, size, extra = '' }) {
  const formId = `form-${++n}`;
  const dlg = openDialog({
    title,
    description,
    size,
    body: html`<form id="${formId}" class="form-grid" novalidate>
      <div class="form-error span-2" role="alert" hidden></div>
      ${fields(defs, values)}
      ${extra}
    </form>`,
    footer: html`<button class="btn" type="button" data-close>Cancel</button>
      <button class="btn btn-primary" type="submit" form="${formId}">${submitLabel ?? (id ? 'Save changes' : 'Create')}</button>`,
  });
  const form = dlg.el.querySelector('form');
  handleForm(form, async (data) => {
    const body = prepare(data, form);
    const res = id ? await api.put(`${endpoint}/${id}`, body) : await api.post(endpoint, body);
    dlg.close();
    toast(res.message);
    onSaved?.(res.data);
  });
  return { ...dlg, form };
}
