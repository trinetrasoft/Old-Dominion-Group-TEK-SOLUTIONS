import { icon } from '../icons.js';

export function searchField({ id = 'list-search', placeholder = 'Search…', value = '' } = {}) {
  return `
  <div class="search-field">
    ${icon('search', 'icon icon-sm')}
    <label class="sr-only" for="${id}">Search</label>
    <input id="${id}" type="search" placeholder="${placeholder}" value="${value}" autocomplete="off">
  </div>`;
}

/** Wire client-side filter for table rows or card list */
export function bindListFilter({ searchId = 'list-search', filterId = null, rowSelector, getText, getFilterValue }) {
  const search = document.getElementById(searchId);
  const filter = filterId ? document.getElementById(filterId) : null;

  const apply = () => {
    const q = (search?.value || '').trim().toLowerCase();
    const f = filter?.value || '';
    document.querySelectorAll(rowSelector).forEach(row => {
      const text = (getText ? getText(row) : row.textContent || '').toLowerCase();
      const fv = getFilterValue ? getFilterValue(row) : (row.dataset.filter || '');
      const matchQ = !q || text.includes(q);
      const matchF = !f || fv === f;
      row.hidden = !(matchQ && matchF);
    });
  };

  search?.addEventListener('input', apply);
  filter?.addEventListener('change', apply);
  apply();
}
