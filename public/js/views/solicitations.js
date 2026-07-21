import { api, bindForm, esc, money, dt } from '../api.js';
import { can, state } from '../state.js';
import { shell, showSkeleton } from '../shell.js';
import { pageHeader } from '../ui/page-header.js';
import { badge } from '../ui/badge.js';
import { skeletonTable } from '../ui/skeleton.js';
import { emptyState } from '../ui/empty.js';
import { searchField, bindListFilter } from '../ui/search.js';
import { toast } from '../ui/toast.js';
import { icon } from '../icons.js';

export async function viewSolicitations() {
  showSkeleton(pageHeader('Bid Solicitations', 'Loading…') + skeletonTable());
  const sols = await api('/vendors/solicitations/all');
  const isVendor = state.user.role === 'vendor';

  shell(`
    ${pageHeader('Bid Solicitations', isVendor
      ? 'Open packages your company can quote'
      : 'Syndicated sub-bid packages — push model, side-by-side comparison')}
    ${can('solicitations:create') ? `
    <div class="panel">
      <div class="panel-head"><h3>${icon('plus', 'icon icon-sm')} New solicitation</h3></div>
      <div class="panel-body">
        <form class="grid" id="sol-form">
          <label class="f full"><span>Title</span><input name="title" required></label>
          <label class="f"><span>Trade</span><input name="trade"></label>
          <label class="f"><span>Responses due</span><input name="due_date" type="date"></label>
          <label class="f full"><span>Scope</span><textarea name="scope"></textarea></label>
          <div class="form-actions"><button class="btn primary" type="submit">${icon('send', 'icon icon-sm')} Publish to vendors</button></div>
        </form>
      </div>
    </div>` : ''}
    <div class="toolbar">
      ${searchField({ placeholder: 'Search solicitations…' })}
    </div>
    <div id="sol-list">
    ${sols.length ? sols.map(s => isVendor ? `
      <div class="panel sol-card filter-row">
        <div class="panel-head">
          <h3>${esc(s.title)} ${badge(s.status)}</h3>
        </div>
        <div class="panel-body">
          <p style="margin:0 0 6px">${esc(s.scope) || '<span class="muted">No scope details.</span>'}</p>
          <p class="muted" style="margin:0 0 12px">Trade: ${esc(s.trade) || '—'} · Due: ${dt(s.due_date)}</p>
          ${s.my_response_status
            ? `<p>Your quote: <strong class="mono tabular">${money(s.my_price)}</strong> ${badge(s.my_response_status)}</p>`
            : (s.status === 'open' && can('solicitations:respond') ? `
              <form class="grid" id="resp-${s.id}">
                <label class="f"><span>Your price ($)</span><input name="price" type="number" min="1" step="0.01" data-type="number" required></label>
                <label class="f"><span>Lead time (days)</span><input name="lead_time_days" type="number" min="1" data-type="number"></label>
                <label class="f full"><span>Exclusions</span><input name="exclusions"></label>
                <div class="form-actions"><button class="btn primary" type="submit">Submit quote</button></div>
              </form>` : '<p class="muted">No response submitted.</p>')}
        </div>
      </div>` : `
      <div class="panel sol-card filter-row">
        <div class="panel-head">
          <h3>${esc(s.title)} ${badge(s.status)}</h3>
          <span class="muted" style="font-size:12.5px">${esc(s.trade) || 'any trade'} · due ${dt(s.due_date)}</span>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Vendor</th><th class="num">Price</th><th class="num">Lead time</th><th>Exclusions</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${(s.responses || []).length ? s.responses.map(r => `<tr>
              <td><strong>${esc(r.company)}</strong></td>
              <td class="num">${money(r.price)}</td>
              <td class="num">${r.lead_time_days ?? '—'}</td>
              <td>${esc(r.exclusions) || '—'}</td>
              <td>${badge(r.status)}</td>
              <td>${can('solicitations:award') && s.status === 'open'
                ? `<button class="btn sm primary" data-req="POST /vendors/solicitations/${s.id}/award" data-body='{"response_id":${r.id}}' data-msg="Awarded to ${esc(r.company)}">Award</button>`
                : ''}</td>
            </tr>`).join('') : `<tr><td colspan="6">${emptyState({ title: 'No vendor responses yet', hint: 'Quotes will appear here as vendors respond.', icon: 'inbox', compact: true })}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`).join('') : emptyState({ title: 'No solicitations', hint: 'Publish a package to solicit vendor quotes.', icon: 'send' })}
    </div>
  `, { title: 'Solicitations' });

  if (state.globalSearch) {
    const s = document.getElementById('list-search');
    if (s) s.value = state.globalSearch;
  }
  bindListFilter({ rowSelector: '.filter-row' });
  bindForm('sol-form', async body => {
    await api('/vendors/solicitations', { method: 'POST', body });
    toast('Solicitation published');
    window.render?.();
  });
  for (const s of sols) {
    bindForm(`resp-${s.id}`, async body => {
      await api(`/vendors/solicitations/${s.id}/respond`, { method: 'POST', body });
      toast('Quote submitted');
      window.render?.();
    });
  }
}
