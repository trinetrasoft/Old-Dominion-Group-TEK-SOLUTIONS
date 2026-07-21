import { api, bindForm, esc, money, dt } from '../api.js';
import { can, state } from '../state.js';
import { shell, showSkeleton } from '../shell.js';
import { pageHeader } from '../ui/page-header.js';
import { dataTable } from '../ui/table.js';
import { badge } from '../ui/badge.js';
import { skeletonTable } from '../ui/skeleton.js';
import { searchField, bindListFilter } from '../ui/search.js';
import { filterSelect, uniqueStatuses } from '../ui/filters.js';
import { toast } from '../ui/toast.js';
import { icon } from '../icons.js';

export async function viewOpportunities() {
  showSkeleton(pageHeader('Opportunities', 'Stage 1 — lead intake, prequalification, and go/no-go') + skeletonTable());
  const rows = await api('/opportunities');
  const canCreate = can('opportunities:create');
  const canUpdate = can('opportunities:update');
  const canDecide = can('opportunities:decide');
  const statuses = uniqueStatuses(rows);

  shell(`
    ${pageHeader('Opportunities', 'Stage 1 — lead intake, prequalification, and go/no-go')}
    ${canCreate ? `
    <div class="panel">
      <div class="panel-head"><h3>${icon('plus', 'icon icon-sm')} Log a new opportunity</h3></div>
      <div class="panel-body">
        <form class="grid" id="opp-form">
          <label class="f"><span>Title</span><input name="title" required></label>
          <label class="f"><span>Client / GC</span><input name="client" required></label>
          <label class="f"><span>Source</span><select name="source"><option value="rfq">RFQ</option><option value="rfp">RFP</option><option value="bid_stream">Bid stream</option><option value="referral">Referral</option></select></label>
          <label class="f"><span>Estimated value ($)</span><input name="est_value" type="number" min="0" data-type="number"></label>
          <label class="f"><span>Bid due date</span><input name="due_date" type="date"></label>
          <label class="f full"><span>Description</span><textarea name="description"></textarea></label>
          <div class="form-actions"><button class="btn primary" type="submit">${icon('plus', 'icon icon-sm')} Add opportunity</button></div>
        </form>
      </div>
    </div>` : ''}
    <div class="toolbar">
      ${searchField({ placeholder: 'Search opportunities…' })}
      ${filterSelect({ options: statuses })}
    </div>
    ${dataTable({
      cols: [{ h: '#' }, { h: 'Opportunity' }, { h: 'Client' }, { h: 'Source' }, { h: 'Est. value', num: 1 }, { h: 'Due' }, { h: 'Status' }, { h: 'Actions' }],
      emptyTitle: 'No opportunities yet',
      emptyHint: 'Log an RFQ or RFP to start the pipeline.',
      emptyIcon: 'briefcase',
      rows: rows.map(o => `<tr class="filter-row" data-filter="${esc(o.status)}">
        <td class="mono">${o.id}</td>
        <td><strong>${esc(o.title)}</strong>${o.estimator_name ? `<div class="muted" style="font-size:12.5px">Estimator: ${esc(o.estimator_name)}</div>` : ''}</td>
        <td>${esc(o.client)}</td>
        <td class="mono">${esc(o.source)}</td>
        <td class="num">${money(o.est_value)}</td>
        <td class="mono">${dt(o.due_date)}</td>
        <td>${badge(o.status)}</td>
        <td><div class="btn-row">
          ${canUpdate && o.status === 'intake' ? `<button class="btn sm" data-req="PATCH /opportunities/${o.id}" data-body='{"status":"prequalification"}' data-msg="Moved to prequalification">Prequalify</button>` : ''}
          ${canDecide && o.status === 'prequalification' ? `
            <button class="btn sm primary" data-req="POST /opportunities/${o.id}/decision" data-body='{"decision":"go"}' data-msg="Go decision recorded">Go</button>
            <button class="btn sm danger" data-req="POST /opportunities/${o.id}/decision" data-body='{"decision":"no_go"}' data-msg="No-go recorded">No-go</button>` : ''}
        </div></td>
      </tr>`),
    })}
  `, { title: 'Opportunities' });

  if (state.globalSearch) {
    const s = document.getElementById('list-search');
    if (s) s.value = state.globalSearch;
  }
  bindListFilter({ rowSelector: '.filter-row' });
  bindForm('opp-form', async body => {
    await api('/opportunities', { method: 'POST', body });
    toast('Opportunity added');
    window.render?.();
  });
}
