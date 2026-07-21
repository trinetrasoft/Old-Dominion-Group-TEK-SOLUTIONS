import { icon } from '../icons.js';

let host;

function ensureHost() {
  if (!host) {
    host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      host.className = 'toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
  }
  return host;
}

export function toast(msg, err = false) {
  const el = document.createElement('div');
  el.className = 'toast ' + (err ? 'err' : 'ok');
  el.setAttribute('role', 'status');
  el.innerHTML = `
    ${icon(err ? 'alert-circle' : 'check-circle-2', 'icon toast-icon')}
    <div>${String(msg)}</div>`;
  ensureHost().appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  }, 3400);
}
