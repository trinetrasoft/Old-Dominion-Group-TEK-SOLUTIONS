import { api, bindForm, esc, money } from '../api.js';
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

export async function viewBids() {
  showSkeleton(pageHeader('Bids & Estimates', 'Stage 2 — pricing, review, submission, and award') + skeletonTable());
  const [bids, opps] = await Promise.all([
    api('/bids'),
    can('bids:create') ? api('/opportunities') : Promise.resolve([]),
  ]);
  const goOpps = (opps || []).filter(o => o.status === 'go');
  const statuses = uniqueStatuses(bids);

  shell(`
    ${pageHeader('Bids & Estimates', 'Stage 2 — pricing, review, submission, and award')}
    ${can('bids:create') ? `
    <div class="panel">
      <div class="panel-head"><h3>${icon('plus', 'icon icon-sm')} New bid</h3></div>
      <div class="panel-body">
        <form class="grid" id="bid-form">
          <label class="f full"><span>Opportunity (Go-decided only)</span>
            <select name="opportunity_id" data-type="number" required>
              ${goOpps.length
                ? goOpps.map(o => `<option value="${o.id}">#${o.id} — ${esc(o.title)}</option>`).join('')
                : '<option value="">No Go-decided opportunities available</option>'}
            </select>
          </label>
          <label class="f"><span>Labor cost ($)</span><input name="labor_cost" type="number" min="0" step="0.01" data-type="number" value="0"></label>
          <label class="f"><span>Material cost ($)</span><input name="material_cost" type="number" min="0" step="0.01" data-type="number" value="0"></label>
          <label class="f"><span>Subcontract cost ($)</span><input name="sub_cost" type="number" min="0" step="0.01" data-type="number" value="0"></label>
          <label class="f"><span>Margin %</span><input name="margin_pct" type="number" min="0" max="100" step="0.1" data-type="number" value="15"></label>
          <label class="f full"><span>Scope summary</span><textarea name="scope_summary"></textarea></label>
          <label class="f full"><span>Risk notes</span><textarea name="risk_notes"></textarea></label>
          <div class="form-actions"><button class="btn primary" type="submit" ${goOpps.length ? '' : 'disabled'}>${icon('plus', 'icon icon-sm')} Create bid</button></div>
        </form>
      </div>
    </div>` : ''}
    <div class="toolbar">
      ${searchField({ placeholder: 'Search bids…' })}
      ${filterSelect({ options: statuses })}
    </div>
    ${dataTable({
      cols: [{ h: '#' }, { h: 'Opportunity' }, { h: 'Client' }, { h: 'Total price', num: 1 }, { h: 'Margin', num: 1 }, { h: 'Status' }, { h: 'Actions' }],
      emptyTitle: 'No bids yet',
      emptyHint: 'Create a bid against a Go-decided opportunity.',
      emptyIcon: 'file-text',
      rows: bids.map(b => `<tr class="filter-row" data-filter="${esc(b.status)}">
        <td class="mono">${b.id}</td>
        <td><strong>${esc(b.opportunity_title)}</strong><div class="muted" style="font-size:12.5px">${esc(b.created_by_name)}</div></td>
        <td>${esc(b.client)}</td>
        <td class="num">${money(b.total_price)}</td>
        <td class="num">${b.margin_pct}%</td>
        <td>${badge(b.status)}</td>
        <td><div class="btn-row">
          ${can('bids:submit') && b.status === 'draft' ? `<button class="btn sm" data-req="POST /bids/${b.id}/status" data-body='{"status":"in_review"}' data-msg="Sent for review">Send to review</button>` : ''}
          ${can('bids:submit') && b.status === 'in_review' ? `
            <button class="btn sm primary" data-req="POST /bids/${b.id}/status" data-body='{"status":"submitted"}' data-msg="Bid submitted to client">Submit</button>
            <button class="btn sm" data-req="POST /bids/${b.id}/status" data-body='{"status":"draft"}' data-msg="Returned to draft">Back to draft</button>` : ''}
          ${can('bids:award') && b.status === 'submitted' ? `
            <button class="btn sm primary" data-req="POST /bids/${b.id}/award" data-body='{"outcome":"won"}' data-msg="Marked won — project created">Won</button>
            <button class="btn sm danger" data-req="POST /bids/${b.id}/award" data-body='{"outcome":"lost"}' data-msg="Marked lost">Lost</button>` : ''}
        </div></td>
      </tr>`),
    })}
  `, { title: 'Bids & Estimates' });

  if (state.globalSearch) {
    const s = document.getElementById('list-search');
    if (s) s.value = state.globalSearch;
  }
  bindListFilter({ rowSelector: '.filter-row' });
  bindForm('bid-form', async body => {
    await api('/bids', { method: 'POST', body });
    toast('Bid created');
    window.render?.();
  });
}
