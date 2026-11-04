import { api } from '../api.js';
import { html, render as draw, $ } from '../dom.js';
import { icon } from '../icons.js';
import { activePill, num } from '../format.js';
import { createList } from '../ui/list.js';
import { formDialog } from '../ui/formDialog.js';
import { confirmDialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { pageHeader } from './shared.js';

const defs = [
  { name: 'name', label: 'Supplier name', required: true, span: true, attrs: { maxlength: 120 } },
  { name: 'contact_person', label: 'Contact person', attrs: { maxlength: 120 } },
  { name: 'phone', label: 'Phone', type: 'tel', attrs: { maxlength: 20 } },
  { name: 'email', label: 'Email', type: 'email', span: true, attrs: { maxlength: 120 } },
  { name: 'address', label: 'Address', type: 'textarea', span: true, attrs: { maxlength: 255, rows: 2 } },
];

export async function render(container) {
  draw(container, html`
    ${pageHeader('Suppliers', 'Distributors you receive stock from. Each batch records its supplier.',
      html`<button class="btn btn-primary" type="button" id="add-supplier">${icon('plus')}Add supplier</button>`)}
    <section class="panel" id="supplier-list"></section>`);

  const list = createList($('#supplier-list', container), {
    endpoint: '/suppliers',
    caption: 'Suppliers',
    toolbar: html`<label class="sr-only" for="s-status">Status</label>
      <select class="select" id="s-status" name="status" data-filter><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select>`,
    columns: [
      { label: 'Supplier', render: (s) => html`<span class="primary-cell">${s.name}</span>${s.address ? html`<span class="secondary-line">${s.address}</span>` : ''}` },
      { label: 'Contact', render: (s) => html`${s.contact_person ?? html`<span class="subtle">Not recorded</span>`}<span class="secondary-line">${[s.phone, s.email].filter(Boolean).join(' · ')}</span>` },
      { label: 'Batches supplied', num: true, render: (s) => num(s.batch_count) },
      { label: 'Status', render: (s) => activePill(s.is_active) },
      { label: html`<span class="sr-only">Actions</span>`, className: 'actions', render: (s) => html`
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${s.supplier_id}">Edit</button>
        ${s.is_active ? html`<button class="btn btn-ghost btn-sm" type="button" data-deactivate="${s.supplier_id}" data-name="${s.name}">Deactivate</button>` : ''}` },
    ],
    empty: { icon: 'truck', title: 'No suppliers yet', message: 'Add the distributors you buy from so every batch can be traced to its source.' },
  });

  const edit = async (id) => {
    const supplier = id ? (await api.get(`/suppliers/${id}`)).data : null;
    formDialog({
      title: supplier ? `Edit ${supplier.name}` : 'Add supplier',
      defs: supplier ? [...defs, { name: 'is_active', label: 'Active supplier', type: 'checkbox', span: true }] : defs,
      values: supplier ?? {},
      endpoint: '/suppliers',
      id,
      submitLabel: supplier ? 'Save changes' : 'Add supplier',
      onSaved: () => list.reload(),
    });
  };
  $('#add-supplier', container).addEventListener('click', () => edit());
  container.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) edit(editBtn.dataset.edit);
    const off = e.target.closest('[data-deactivate]');
    if (off) {
      const ok = await confirmDialog({
        title: `Deactivate ${off.dataset.name}?`,
        message: 'It will no longer be offered when receiving stock. Batches already received keep this supplier.',
        confirmLabel: 'Deactivate', danger: true,
        onConfirm: () => api.del(`/suppliers/${off.dataset.deactivate}`),
      });
      if (ok) { toast('Supplier deactivated.'); list.reload(); }
    }
  });
}
