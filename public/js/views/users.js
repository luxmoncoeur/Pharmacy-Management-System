import { api } from '../api.js';
import { html, render as draw, $ } from '../dom.js';
import { icon } from '../icons.js';
import { dateTime, date, activePill, ROLE_LABELS, roleLabel } from '../format.js';
import { isOwner, session } from '../session.js';
import { createList } from '../ui/list.js';
import { formDialog } from '../ui/formDialog.js';
import { confirmDialog } from '../ui/dialog.js';
import { toast } from '../ui/toast.js';
import { pageHeader, branchFilter, branches } from './shared.js';

export async function render(container) {
  const admin = isOwner();
  draw(container, html`
    ${pageHeader('Staff accounts', admin
    ? 'Everyone who can sign in. Managers run a branch (or all branches, if no branch is set). Pharmacists check prescriptions. Cashiers sell.'
    : `Staff at ${session.user.branch_name}. Ask the owner to add or change accounts.`,
      admin ? html`<button class="btn btn-primary" type="button" id="add-user">${icon('user-plus')}Add staff account</button>` : '')}
    <section class="panel" id="user-list"></section>`);

  const list = createList($('#user-list', container), {
    endpoint: '/users',
    caption: 'Staff accounts',
    toolbar: html`
      <div class="input-icon grow">${icon('search')}<label class="sr-only" for="u-q">Search staff</label>
        <input class="input" id="u-q" type="search" name="q" data-filter placeholder="Name or username"></div>
      <label class="sr-only" for="u-role">Role</label>
      <select class="select" id="u-role" name="role" data-filter><option value="">All roles</option>${Object.entries(ROLE_LABELS).map(([k, l]) => html`<option value="${k}">${l}</option>`)}</select>
      <label class="sr-only" for="u-status">Status</label>
      <select class="select" id="u-status" name="status" data-filter><option value="active">Active</option><option value="inactive">Deactivated</option><option value="all">All</option></select>
      ${await branchFilter()}`,
    columns: [
      { label: 'Name', sortKey: 'full_name', render: (u) => html`<span class="primary-cell">${u.full_name}</span><span class="secondary-line mono">${u.username}</span>` },
      { label: 'Role', sortKey: 'role', render: (u) => html`${roleLabel(u)}${u.license_no ? html`<span class="secondary-line">PRC ${u.license_no}${u.license_days_left !== null && u.license_days_left <= 60
        ? html` · <span style="color:var(--${u.license_days_left < 0 ? 'danger' : 'warning'}-text)">${u.license_days_left < 0 ? 'expired' : `expires ${date(u.license_expiry)}`}</span>` : ''}</span>` : ''}` },
      { label: 'Branch', render: (u) => u.branch_name ?? html`<span class="subtle">All branches</span>` },
      { label: 'Last sign-in', sortKey: 'last_login_at', render: (u) => (u.last_login_at ? dateTime(u.last_login_at) : html`<span class="subtle">Never</span>`) },
      { label: 'Status', render: (u) => activePill(u.is_active) },
      ...(admin ? [{ label: html`<span class="sr-only">Actions</span>`, className: 'actions', render: (u) => html`
        <button class="btn btn-ghost btn-sm" type="button" data-edit="${u.user_id}">Edit</button>
        ${u.is_active && u.user_id !== session.user.user_id ? html`<button class="btn btn-ghost btn-sm" type="button" data-deactivate="${u.user_id}" data-name="${u.full_name}">Deactivate</button>` : ''}` }] : []),
    ],
    empty: { icon: 'users', title: 'No staff accounts', message: 'Add an account for each person who uses the system. Never share accounts: sales and stock history record who did what.' },
  });

  if (!admin) return;
  const defs = async (editing) => {
    const list_ = await branches();
    return [
      { name: 'full_name', label: 'Full name', required: true, attrs: { maxlength: 120 } },
      { name: 'username', label: 'Username', required: true, attrs: { maxlength: 50, autocomplete: 'off', autocapitalize: 'none' }, hint: 'Letters, numbers, dots, dashes' },
      { name: 'role', label: 'Role', type: 'select', required: true, placeholder: 'Choose a role', options: Object.entries(ROLE_LABELS) },
      { name: 'branch_id', label: 'Branch', type: 'select', placeholder: 'All branches (owner)', options: list_.map((b) => [b.branch_id, b.name]), hint: 'Only a manager can be left on "All branches"' },
      { name: 'license_no', label: 'PRC license number', attrs: { maxlength: 30 }, hint: 'Printed on prescriptions they verify' },
      { name: 'license_expiry', label: 'License expiry', type: 'date' },
      { name: 'password', label: editing ? 'New password' : 'Temporary password', type: 'password', required: !editing, span: true,
        attrs: { minlength: 8, autocomplete: 'new-password' }, hint: editing ? 'Leave blank to keep the current password' : 'At least 8 characters with a letter and a number. Ask them to change it after signing in.' },
      ...(editing ? [{ name: 'is_active', label: 'Account can sign in', type: 'checkbox', span: true }] : []),
    ];
  };
  const edit = async (id) => {
    const user = id ? (await api.get(`/users/${id}`)).data : null;
    const dlg = formDialog({
      title: user ? `Edit ${user.full_name}` : 'Add staff account',
      defs: await defs(Boolean(user)),
      values: user ?? {},
      endpoint: '/users',
      id,
      submitLabel: user ? 'Save changes' : 'Create account',
      prepare: (d) => ({ ...d, branch_id: d.branch_id || null, license_no: d.license_no || null, license_expiry: d.license_expiry || null, ...(user && !d.password ? { password: undefined } : {}) }),
      onSaved: () => list.reload(),
    });
    // License fields only matter for pharmacists.
    const form = dlg.form;
    const sync = () => {
      const pharmacist = form.querySelector('[name="role"]').value === 'pharmacist';
      ['license_no', 'license_expiry'].forEach((n) => {
        const el = form.querySelector(`[name="${n}"]`);
        el.closest('.field').hidden = !pharmacist;
        el.required = pharmacist;
      });
    };
    form.querySelector('[name="role"]').addEventListener('change', sync);
    sync();
  };
  $('#add-user', container).addEventListener('click', () => edit());
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) edit(b.dataset.edit);
    const off = e.target.closest('[data-deactivate]');
    if (off) {
      const ok = await confirmDialog({
        title: `Deactivate ${off.dataset.name}?`,
        message: 'They are signed out immediately and can no longer sign in. Their sales and history are kept.',
        confirmLabel: 'Deactivate account', danger: true,
        onConfirm: () => api.del(`/users/${off.dataset.deactivate}`),
      });
      if (ok) { toast('Account deactivated.'); list.reload(); }
    }
  });
}
