// Hash router: #/name or #/name/:id. Each view module exports render(container, { id, query }) and an optional cleanup.
const routes = new Map();
let current = null;
let onChange = () => {};

export const route = (name, loader, options = {}) => routes.set(name, { loader, ...options });
export const onRouteChange = (fn) => { onChange = fn; };

export function parseHash() {
  const [path, queryString = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [name = '', id] = path.split('/');
  return { name, id: id ? decodeURIComponent(id) : undefined, query: Object.fromEntries(new URLSearchParams(queryString)) };
}

export const navigate = (hash) => { if (location.hash !== hash) location.hash = hash; else resolve(); };

export async function resolve(fallback = 'home') {
  const { name, id, query } = parseHash();
  const entry = routes.get(name);
  if (!entry) return navigate(`#/${fallback}`);
  if (entry.allowed && !entry.allowed()) return navigate(`#/${fallback}`);

  current?.cleanup?.();
  // Dialogs belong to the page that opened them; leaving the page closes them.
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  // A fresh element per page: listeners a view attached to its container are discarded with it,
  // so handlers from a previously visited page can never fire on this one.
  const container = document.createElement('div');
  container.className = 'view-root';
  document.getElementById('view').replaceChildren(container);
  onChange(name, entry);
  const mod = await entry.loader();
  const cleanup = await mod.render(container, { id, query });
  current = { name, cleanup };
}

window.addEventListener('hashchange', () => resolve());
