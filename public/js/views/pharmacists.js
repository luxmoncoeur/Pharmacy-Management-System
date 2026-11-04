import { api } from '../api.js';
import { html, render as draw, $ } from '../dom.js';
import { icon } from '../icons.js';
import { date, activePill } from '../format.js';
import { isAdmin } from '../session.js';
import { createList } from '../ui/list.js';
import { formDialog } from '../ui/formDialog.js';
import { confirmDialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { pageHeader } from './shared.js';

const licensePill = (p) => {
  const d = Number(p.license_days_left);
  if (d < 0) return html`<span class="pill pill-danger">Expired ${date(p.license_expiry)}</span>`;
  if (d <= 60) return html`<span class="pill pill-warn">Expires in ${d} days</span>`;
  return html`<span class="pill pill-ok">Valid to ${date(p.license_expiry)}</span>`;
};

export async function render(container) {
  const admin = isAdmin();
  draw(container, html`
    ${pageHeader('Pharmacists', 'Licensed pharmacists and their PRC license validity. Only a pharmacist account linked here can verify prescriptions.',
      admin ? html`<button class="btn btn-primary" type="button" id="add-ph">${icon('plus')}Add pharmacist</button>` : '')}
    <section class="panel" id="ph-list"></section>`);

  const list = createList($('#ph-list', container), {
    endpoint: '/pharmacists',
    caption: 'Pharmacists',
    toolbar: html`
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="ph-q">Search pharmacists</label>
        <input class="input" id="ph-q" type="search" name="q" data-filter placeholder="Name, license number, or email"></div>
      <label class="sr-only" for="ph-status">Status</label>
      <select class="select" id="ph-status" name="status" data-filter><option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option></select>`,
    columns: [
      { label: 'Name', render: (p) => html`<span class="primary-cell">${p.lastname}, ${p.firstname}</span><span class="secondary-line">${[p.phone, p.email].filter(Boolean).join(' · ')}</span>` },
      { label: 'PRC license', render: (p) => html`<span class="mono">${p.license_no}</span>` },
      { label: 'Validity', render: licensePill },
      { label: 'Account', render: (p) => (p.username ? html`<span class="mono">${p.username}</span><span class="secondary-line">${p.branch_name ?? ''}</span>` : html`<span class="subtle">No sign-in account</span>`) },
      { label: 'Status', render: (p) => activePill(p.is_active) },
      ...(admin ? [{ label: html`<span class="sr-only">Actions</span>`, className: 'actions', render: (p) => html`
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${p.pharmacist_id}">Edit</button>
        ${p.is_active ? html`<button class="btn btn-ghost btn-sm" type="button" data-off="${p.pharmacist_id}" data-name="${p.firstname} ${p.lastname}">Deactivate</button>` : ''}` }] : []),
    ],
    empty: { icon: 'stethoscope', title: 'No pharmacists yet', message: 'Add each licensed pharmacist and link them to their sign-in account.' },
  });
  if (!admin) return;

  const edit = async (id) => {
    const [ph, users] = await Promise.all([
      id ? api.get(`/pharmacists/${id}`).then((r) => r.data) : null,
      api.get('/users', { role: 'pharmacist', limit: 200 }).then((r) => r.data),
    ]);
    formDialog({
      title: ph ? `Edit ${ph.firstname} ${ph.lastname}` : 'Add pharmacist',
      defs: [
        { name: 'firstname', label: 'First name', required: true, attrs: { maxlength: 60 } },
        { name: 'lastname', label: 'Last name', required: true, attrs: { maxlength: 60 } },
        { name: 'license_no', label: 'PRC license number', required: true, attrs: { maxlength: 30 } },
        { name: 'license_expiry', label: 'License valid until', type: 'date', required: true },
        { name: 'phone', label: 'Phone', type: 'tel', attrs: { maxlength: 20 } },
        { name: 'email', label: 'Email', type: 'email', attrs: { maxlength: 120 } },
        { name: 'user_id', label: 'Sign-in account', type: 'select', span: true, placeholder: 'Not linked', options: users.map((u) => [u.user_id, `${u.full_name} (${u.username}, ${u.branch_name ?? 'no branch'})`]), hint: 'Linking lets this account verify prescriptions' },
        ...(ph ? [{ name: 'is_active', label: 'Active', type: 'checkbox', span: true }] : []),
      ],
      values: ph ?? {},
      endpoint: '/pharmacists',
      id,
      submitLabel: ph ? 'Save changes' : 'Add pharmacist',
      prepare: (d) => ({ ...d, user_id: d.user_id || null }),
      onSaved: () => list.reload(),
    });
  };
  $('#add-ph', container).addEventListener('click', () => edit());
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) edit(b.dataset.edit);
    const off = e.target.closest('[data-off]');
    if (off) {
      const ok = await confirmDialog({
        title: `Deactivate ${off.dataset.name}?`, message: 'Prescriptions they already reviewed keep their name.',
        confirmLabel: 'Deactivate', danger: true, onConfirm: () => api.del(`/pharmacists/${off.dataset.off}`),
      });
      if (ok) { toast('Pharmacist deactivated.'); list.reload(); }
    }
  });
}
