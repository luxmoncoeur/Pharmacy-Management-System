import { api } from './api.js';
import { handleForm } from './ui/form.js';
import { setThemePref } from './theme.js';

// Already signed in: go straight to the app.
api.get('/auth/me').then(() => location.replace('/')).catch(() => {});

const form = document.getElementById('login-form');
const card = document.getElementById('auth-card');

handleForm(form, async (data) => {
  try {
    await api.post('/auth/login', data);
  } catch (err) {
    shake();
    throw err; // handleForm shows the message
  }
  const next = new URLSearchParams(location.search).get('next');
  // Without a destination the app picks the right start page for the role (Sell for cashiers, Home otherwise).
  location.replace(`/${next && next.startsWith('#/') ? next : ''}`);
});

function shake() {
  card.classList.remove('shake');
  void card.offsetWidth; // restart the animation if it is already applied
  card.classList.add('shake');
}
card.addEventListener('animationend', (e) => {
  if (e.animationName === 'shake') card.classList.remove('shake');
});

// Stagger order for the entrance animation.
document.querySelectorAll('.auth-hero .reveal, .auth-hero .word').forEach((el, i) => el.style.setProperty('--i', i));
document.querySelectorAll('.auth-side .reveal').forEach((el, i) => el.style.setProperty('--i', i + 1));

// Show / hide password.
const password = document.getElementById('password');
const toggle = document.getElementById('toggle-password');
toggle.addEventListener('click', () => {
  const show = password.type === 'password';
  password.type = show ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(show));
  toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  password.focus({ preventScroll: true });
});

// Caps Lock warning while typing the password.
const capsHint = document.getElementById('caps-hint');
const updateCaps = (e) => { if (e.getModifierState) capsHint.hidden = !e.getModifierState('CapsLock'); };
password.addEventListener('keydown', updateCaps);
password.addEventListener('keyup', updateCaps);
password.addEventListener('blur', () => { capsHint.hidden = true; });

// Theme toggle.
const themeBtn = document.getElementById('theme-toggle');
const syncThemeLabel = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
};
themeBtn.addEventListener('click', () => {
  setThemePref(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  syncThemeLabel();
});
syncThemeLabel();

// Spotlight that follows the pointer over the card (mouse/trackpad only).
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  card.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}
