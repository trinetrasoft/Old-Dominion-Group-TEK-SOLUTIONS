import { state, setSession, clearSession } from './state.js';
import { toast } from './ui/toast.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function money(v) {
  return v == null ? '—' : '$' + Math.round(Number(v)).toLocaleString('en-US');
}

export function dt(s) {
  return s ? s.slice(0, 10) : '—';
}

export async function api(path, opts = {}) {
  const doFetch = () => fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(state.access ? { Authorization: 'Bearer ' + state.access } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  let res = await doFetch();
  if (res.status === 401 && state.refresh && !opts._retried) {
    const ok = await tryRefresh();
    if (ok) return api(path, { ...opts, _retried: true });
    logout(true);
    throw new Error('Session expired');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || (data.details || []).join('; ') || `Request failed (${res.status})`);
  }
  return data;
}

export async function tryRefresh() {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setSession(data);
    return true;
  } catch {
    return false;
  }
}

export function logout(silent) {
  if (state.access) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + state.access,
      },
      body: JSON.stringify({ refreshToken: state.refresh }),
    }).catch(() => {});
  }
  clearSession();
  if (!silent) toast('Signed out');
  location.hash = '';
  window.render?.();
}

export function bindForm(id, handler) {
  const form = document.getElementById(id);
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {};
    for (const [k, v] of fd.entries()) {
      if (v === '') continue;
      const el = form.elements[k];
      body[k] = el?.dataset?.type === 'number' ? Number(v) : v;
    }
    const btn = form.querySelector('button[type=submit]');
    const prev = btn?.innerHTML;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Saving…`;
    }
    try {
      await handler(body);
    } catch (err) {
      toast(err.message, true);
    }
    if (btn) {
      btn.disabled = false;
      if (prev) btn.innerHTML = prev;
    }
  });
}

export async function act(fn, msg) {
  try {
    await fn();
    if (msg) toast(msg);
    window.render?.();
  } catch (e) {
    toast(e.message, true);
  }
}

export function setupActionDelegation() {
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-req]');
    if (!b || b.disabled) return;
    const [method, path] = b.dataset.req.split(' ');
    let body;
    if (b.dataset.body) {
      try { body = JSON.parse(b.dataset.body); } catch { body = undefined; }
    }
    act(() => api(path, { method, body }), b.dataset.msg || '');
  });
}
