import { api } from './api.js';
import { handleForm } from './ui/form.js';

// Already signed in: go straight to the app.
api.get('/auth/me').then(() => location.replace('/')).catch(() => {});

const form = document.getElementById('login-form');
handleForm(form, async (data) => {
  const res = await api.post('/auth/login', data);
  const next = new URLSearchParams(location.search).get('next');
  const fallback = ['cashier'].includes(res.data.role) ? '#/pos' : '#/dashboard';
  location.replace(`/${next && next.startsWith('#/') ? next : fallback}`);
});
