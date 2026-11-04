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
  { name: 'name', label: 'Branch name', required: true, span: true, attrs: { maxlength: 100 } },
  { name: 'address', label: 'Address', type: 'textarea', required: true, span: true, attrs: { maxlength: 255, rows: 2 }, hint: 'Printed on receipts' },
  { name: 'phone', label: 'Phone', type: 'tel', attrs: { maxlength: 20 } },
];

export async function render(container) {
  draw(container, html`
    ${pageHeader('Branches', 'Each branch has its own stock, staff, and sales.', html`<button class="btn btn-primary" type="button" id="add-branch">${icon('plus')}Add branch</button>`)}
    <section class="panel" id="branch-list"></section>`);
  const list = createList($('#branch-list', container), {
    endpoint: '/branches',
    params: { status: 'all' },
    caption: 'Branches',
    columns: [
      { label: 'Branch', render: (b) => html`<span class="primary-cell">${b.name}</span><span class="secondary-line">${b.address}</span>` },
      { label: 'Phone', render: (b) => b.phone ?? html`<span class="subtle">None</span>` },
      { label: 'Active staff', num: true, render: (b) => num(b.staff_count) },
      { label: 'Status', render: (b) => activePill(b.is_active) },
      { label: html`<span class="sr-only">Actions</span>`, className: 'actions', render: (b) => html`
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${b.branch_id}">Edit</button>
        ${b.is_active ? html`<button class="btn btn-ghost btn-sm" type="button" data-off="${b.branch_id}" data-name="${b.name}">Deactivate</button>` : ''}` },
    ],
    empty: { icon: 'building-2', title: 'No branches', message: 'Add your first branch to start receiving stock and selling.' },
  });
  const edit = async (id) => {
    const branch = id ? (await api.get(`/branches/${id}`)).data : null;
    formDialog({
      title: branch ? `Edit ${branch.name}` : 'Add branch',
      defs: branch ? [...defs, { name: 'is_active', label: 'Active branch', type: 'checkbox', span: true }] : defs,
      values: branch ?? {}, endpoint: '/branches', id, submitLabel: branch ? 'Save changes' : 'Add branch',
      onSaved: () => list.reload(),
    });
  };
  $('#add-branch', container).addEventListener('click', () => edit());
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) edit(b.dataset.edit);
    const off = e.target.closest('[data-off]');
    if (off) {
      const ok = await confirmDialog({
        title: `Deactivate ${off.dataset.name}?`, message: 'Move or deactivate its staff accounts first. Its sales history and batches are kept.',
        confirmLabel: 'Deactivate branch', danger: true, onConfirm: () => api.del(`/branches/${off.dataset.off}`),
      });
      if (ok) { toast('Branch deactivated.'); list.reload(); }
    }
  });
}
