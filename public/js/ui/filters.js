import { esc } from '../api.js';

export function filterSelect({ id = 'list-filter', label = 'Status', options = [], allLabel = 'All statuses' } = {}) {
  return `
  <label class="sr-only" for="${id}">${esc(label)}</label>
  <select id="${id}" class="filter-select" aria-label="${esc(label)}">
    <option value="">${esc(allLabel)}</option>
    ${options.map(o => {
      const v = typeof o === 'string' ? o : o.value;
      const t = typeof o === 'string' ? o.replace(/_/g, ' ') : o.label;
      return `<option value="${esc(v)}">${esc(t)}</option>`;
    }).join('')}
  </select>`;
}

export function uniqueStatuses(rows, key = 'status') {
  return [...new Set(rows.map(r => r[key]).filter(Boolean))].sort();
}
