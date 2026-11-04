export class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors ?? null;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  const payload = await res.json().catch(() => ({}));
  if (res.status === 401 && !location.pathname.startsWith('/login')) {
    const next = encodeURIComponent(location.hash || '');
    location.replace(`/login${next ? `?next=${next}` : ''}`);
    throw new ApiError(401, payload.message || 'Please sign in.');
  }
  if (!res.ok || payload.success === false) {
    throw new ApiError(res.status, payload.message || `Request failed (${res.status}).`, payload.errors);
  }
  return payload;
}

/** Builds a query string, skipping empty values so filters stay optional. */
export const qs = (params = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: (path, params) => request('GET', path + qs(params)),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  del: (path) => request('DELETE', path),
};
