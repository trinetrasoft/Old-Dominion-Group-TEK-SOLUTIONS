import { api, bindForm, esc } from '../api.js';
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

export async function viewVendors() {
  showSkeleton(pageHeader('Vendor Portal', 'Onboarding → compliance review → approval, with scorecards') + skeletonTable());
  const vendors = await api('/vendors');
  const canU = can('vendors:update');
  const canA = can('vendors:approve');
  const statuses = uniqueStatuses(vendors);

  const checks = v => ['insurance', 'legal', 'financial'].map(k =>
    `<span class="badge ${v[k + '_ok'] ? 'success' : ''}" title="${k}">${k.slice(0, 3)}${v[k + '_ok'] ? ' ✓' : ' –'}</span>`
  ).join(' ');

  const score = v => (v.score_quality ?? v.score_delivery ?? v.score_pricing) == null
    ? '—'
    : `Q ${v.score_quality ?? '–'} · D ${v.score_delivery ?? '–'} · P ${v.score_pricing ?? '–'}`;

  shell(`
    ${pageHeader('Vendor Portal', 'Onboarding → compliance review → approval, with scorecards')}
    ${can('vendors:create') ? `
    <div class="panel">
      <div class="panel-head"><h3>${icon('plus', 'icon icon-sm')} Invite a vendor</h3></div>
      <div class="panel-body">
        <form class="grid" id="vendor-form">
          <label class="f"><span>Company</span><input name="company" required></label>
          <label class="f"><span>Trade</span><input name="trade" placeholder="Insulation, HVAC…"></label>
          <label class="f"><span>Contact name</span><input name="contact_name"></label>
          <label class="f"><span>Contact email</span><input name="contact_email" type="email"></label>
          <div class="form-actions"><button class="btn primary" type="submit">${icon('plus', 'icon icon-sm')} Invite vendor</button></div>
        </form>
      </div>
    </div>` : ''}
    <div class="toolbar">
      ${searchField({ placeholder: 'Search vendors…' })}
      ${filterSelect({ options: statuses })}
    </div>
    ${dataTable({
      cols: [{ h: '#' }, { h: 'Company' }, { h: 'Trade' }, { h: 'Compliance' }, { h: 'Scorecard' }, { h: 'Status' }, { h: 'Actions' }],
      emptyTitle: 'No vendors yet',
      emptyHint: 'Invite a trade partner to begin onboarding.',
      emptyIcon: 'building-2',
      rows: vendors.map(v => `<tr class="filter-row" data-filter="${esc(v.status)}">
        <td class="mono">${v.id}</td>
        <td><strong>${esc(v.company)}</strong>${v.contact_email ? `<div class="muted" style="font-size:12.5px">${esc(v.contact_email)}</div>` : ''}</td>
        <td>${esc(v.trade) || '—'}</td>
        <td><div class="checks-row">${checks(v)}</div></td>
        <td class="mono" style="font-size:12px">${score(v)}</td>
        <td>${badge(v.status)}</td>
        <td><div class="btn-row">
          ${canU && v.status === 'invited' ? `<button class="btn sm" data-req="PATCH /vendors/${v.id}" data-body='{"status":"onboarding"}' data-msg="Onboarding started">Start onboarding</button>` : ''}
          ${canU && v.status === 'onboarding' ? `<button class="btn sm" data-req="PATCH /vendors/${v.id}" data-body='{"status":"compliance_review"}' data-msg="Sent to compliance review">To compliance</button>` : ''}
          ${canU && ['onboarding', 'compliance_review'].includes(v.status) ? ['insurance', 'legal', 'financial'].filter(k => !v[k + '_ok']).map(k =>
            `<button class="btn sm" data-req="PATCH /vendors/${v.id}" data-body='{"${k}_ok":true}' data-msg="${k} check passed">Pass ${k}</button>`).join('') : ''}
          ${canA && v.status === 'compliance_review' ? `
            <button class="btn sm primary" data-req="POST /vendors/${v.id}/decision" data-body='{"decision":"approved"}' data-msg="Vendor approved">Approve</button>
            <button class="btn sm danger" data-req="POST /vendors/${v.id}/decision" data-body='{"decision":"rejected"}' data-msg="Vendor rejected">Reject</button>` : ''}
          ${canU && v.status === 'approved' ? `<button class="btn sm danger" data-req="PATCH /vendors/${v.id}" data-body='{"status":"suspended"}' data-msg="Vendor suspended">Suspend</button>` : ''}
          ${canU && v.status === 'suspended' ? `<button class="btn sm" data-req="PATCH /vendors/${v.id}" data-body='{"status":"approved"}' data-msg="Vendor reinstated">Reinstate</button>` : ''}
        </div></td>
      </tr>`),
    })}
  `, { title: 'Vendor Portal' });

  if (state.globalSearch) {
    const s = document.getElementById('list-search');
    if (s) s.value = state.globalSearch;
  }
  bindListFilter({ rowSelector: '.filter-row' });
  bindForm('vendor-form', async body => {
    await api('/vendors', { method: 'POST', body });
    toast('Vendor invited');
    window.render?.();
  });
}
