import { api, esc } from '../api.js';
import { state } from '../state.js';
import { shell, showSkeleton } from '../shell.js';
import { pageHeader } from '../ui/page-header.js';
import { dataTable } from '../ui/table.js';
import { skeletonTable } from '../ui/skeleton.js';
import { searchField, bindListFilter } from '../ui/search.js';

export async function viewAudit() {
  showSkeleton(pageHeader('Audit Log', 'Immutable record of every login, mutation, and denied access') + skeletonTable(8));
  const rows = await api('/audit?limit=300');

  shell(`
    ${pageHeader('Audit Log', 'Immutable record of every login, mutation, and denied access')}
    <div class="toolbar">
      ${searchField({ placeholder: 'Search audit entries…' })}
    </div>
    ${dataTable({
      cols: [{ h: 'When' }, { h: 'Actor' }, { h: 'Action' }, { h: 'Entity' }, { h: 'Detail' }, { h: 'IP' }],
      emptyTitle: 'No audit entries',
      emptyHint: 'Actions will appear here as users interact with the platform.',
      emptyIcon: 'scroll-text',
      rows: rows.map(a => `<tr class="filter-row">
        <td class="mono" style="font-size:12px;white-space:nowrap">${esc(a.created_at)}</td>
        <td class="mono" style="font-size:12px">${esc(a.user_email) || '—'}</td>
        <td class="mono" style="font-size:12px"><strong>${esc(a.action)}</strong></td>
        <td class="mono" style="font-size:12px">${esc(a.entity)}${a.entity_id ? ' #' + a.entity_id : ''}</td>
        <td style="font-size:13px">${esc(a.detail) || '—'}</td>
        <td class="mono" style="font-size:12px">${esc(a.ip) || '—'}</td>
      </tr>`),
    })}
  `, { title: 'Audit Log' });

  if (state.globalSearch) {
    const s = document.getElementById('list-search');
    if (s) s.value = state.globalSearch;
  }
  bindListFilter({ rowSelector: '.filter-row' });
}
