import { api } from './api.js';
import { handleForm } from './ui/form.js';

// Already signed in: go straight to the app.
api.get('/auth/me').then(() => location.replace('/')).catch(() => {});

const form = document.getElementById('login-form');
handleForm(form, async (data) => {
  await api.post('/auth/login', data);
  const next = new URLSearchParams(location.search).get('next');
  // Without a destination the app picks the right start page for the role (Sell for cashiers, Home otherwise).
  location.replace(`/${next && next.startsWith('#/') ? next : ''}`);
});
