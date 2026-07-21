import { emptyState } from './empty.js';

export function dataTable({ cols, rows, emptyTitle = 'Nothing here', emptyHint = '', emptyIcon = 'inbox' }) {
  const body = rows.length
    ? rows.join('')
    : `<tr><td colspan="${cols.length}">${emptyState({ title: emptyTitle, hint: emptyHint, icon: emptyIcon, compact: true })}</td></tr>`;

  return `
  <div class="panel">
    <div class="table-wrap">
      <table class="data">
        <thead><tr>${cols.map(c => `<th class="${c.num ? 'num' : ''}">${c.h}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </div>`;
}
