// Runs before first paint (loaded in <head>) so the page never flashes the wrong theme.
(function () {
  var pref = localStorage.getItem('pms-theme') || 'system';
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
