const KEY = 'pms-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export const getThemePref = () => localStorage.getItem(KEY) || 'system';

function apply() {
  const pref = getThemePref();
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function setThemePref(pref) {
  localStorage.setItem(KEY, pref);
  apply();
}

media.addEventListener('change', apply);
