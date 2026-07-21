import { esc } from '../api.js';

export function badge(status) {
  const s = String(status ?? '');
  const label = s.replace(/_/g, ' ');
  return `<span class="badge ${esc(s)}">${esc(label)}</span>`;
}

export function activeBadge(isActive) {
  return isActive
    ? `<span class="badge active">Active</span>`
    : `<span class="badge inactive">Inactive</span>`;
}
