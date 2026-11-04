import { api } from '../api.js';
import { html, render as draw, $ } from '../dom.js';
import { ROLE_LABELS, dateTime } from '../format.js';
import { session } from '../session.js';
import { handleForm } from '../ui/form.js';
import { fields } from '../ui/fields.js';
import { toast } from '../ui/toast.js';
import { getThemePref, setThemePref } from '../theme.js';
import { pageHeader } from './shared.js';

export async function render(container) {
  const u = session.user;
  const pref = getThemePref();
  draw(container, html`
    ${pageHeader('Your account')}
    <div class="grid-2">
      <section class="panel">
        <div class="panel-header"><h2>Profile</h2></div>
        <div class="panel-body">
          <dl class="details">
            <dt>Name</dt><dd>${u.full_name}</dd>
            <dt>Username</dt><dd class="mono">${u.username}</dd>
            <dt>Role</dt><dd>${ROLE_LABELS[u.role]}</dd>
            <dt>Branch</dt><dd>${u.branch_name ?? 'All branches'}</dd>
            ${u.pharmacist_id ? html`<dt>Pharmacist record</dt><dd>Linked, can verify prescriptions</dd>` : ''}
          </dl>
          <p class="small subtle" style="margin-top:1rem">Ask an administrator to change your name, role or branch.</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Appearance</h2></div>
        <div class="panel-body stack">
          <div class="segmented segmented-block" role="radiogroup" aria-label="Theme">
            ${[['system', 'Match system'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => html`<label><input type="radio" name="theme" value="${v}" ${pref === v ? 'checked' : ''}><span>${l}</span></label>`)}
          </div>
          <p class="small subtle">Saved on this device.</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header"><h2>Change password</h2></div>
        <form class="panel-body form-grid" id="pw-form" novalidate>
          <div class="form-error span-2" role="alert" hidden></div>
          ${fields([
            { name: 'current_password', label: 'Current password', type: 'password', required: true, span: true, attrs: { autocomplete: 'current-password' } },
            { name: 'new_password', label: 'New password', type: 'password', required: true, attrs: { autocomplete: 'new-password', minlength: 8 }, hint: 'At least 8 characters, with a letter and a number' },
            { name: 'confirm', label: 'Confirm new password', type: 'password', required: true, attrs: { autocomplete: 'new-password' } },
          ])}
          <div class="span-2"><button class="btn btn-primary" type="submit">Update password</button></div>
        </form>
      </section>
    </div>`);

  container.querySelectorAll('[name="theme"]').forEach((r) => r.addEventListener('change', () => setThemePref(r.value)));
  const form = $('#pw-form', container);
  handleForm(form, async (data) => {
    if (data.new_password !== data.confirm) throw Object.assign(new Error('Passwords do not match.'), { errors: { confirm: 'This does not match the new password.' } });
    const res = await api.patch('/auth/me/password', { current_password: data.current_password, new_password: data.new_password });
    form.reset();
    toast(res.message);
  });
}

