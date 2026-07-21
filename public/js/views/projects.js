import { api, bindForm, esc, money } from '../api.js';
import { can, state } from '../state.js';
import { shell, showSkeleton } from '../shell.js';
import { pageHeader } from '../ui/page-header.js';
import { badge } from '../ui/badge.js';
import { kpiCard } from '../ui/kpi.js';
import { skeletonTable } from '../ui/skeleton.js';
import { emptyState } from '../ui/empty.js';
import { projectGateTimeline } from '../ui/timeline.js';
import { searchField, bindListFilter } from '../ui/search.js';
import { toast } from '../ui/toast.js';
import { icon } from '../icons.js';

export async function viewProjects() {
  showSkeleton(pageHeader('Projects', 'Stages 3–5 — initiation gates, execution, change orders, billing, closeout') + skeletonTable());
  const projects = await api('/projects');

  shell(`
    ${pageHeader('Projects', 'Stages 3–5 — initiation gates, execution, change orders, billing, closeout')}
    <div class="toolbar">
      ${searchField({ placeholder: 'Search projects…' })}
    </div>
    <div id="project-list">
    ${projects.length ? projects.map(p => {
      const gatesDone = p.cip_enrolled && p.turnover_reviewed;
      return `
      <div class="panel project-card filter-row">
        <div class="panel-head">
          <h3>${esc(p.name)} ${badge(p.status)}</h3>
          <div class="project-meta">
            <span>${esc(p.client)}</span>
            <span>·</span>
            <span>PM: ${esc(p.pm_name) || 'unassigned'}</span>
          </div>
        </div>
        <div class="panel-body">
          <div class="kpi-grid" style="margin-bottom:20px">
            ${kpiCard({ value: money(p.contract_value), label: 'Contract value (incl. approved COs)', icon: 'dollar-sign' })}
            ${kpiCard({ value: money(p.billed_total), label: 'Approved / paid billing', icon: 'trending-up' })}
            ${kpiCard({ value: String(p.pending_cos), label: 'Pending change orders', icon: 'clipboard-list' })}
          </div>
          <h4 style="font-size:13px;font-weight:600;margin-bottom:12px;color:var(--text-secondary)">Project timeline</h4>
          ${projectGateTimeline(p)}
          <div class="btn-row project-actions">
            ${can('projects:update') && p.status === 'initiation' ? `
              ${!p.cip_enrolled ? `<button class="btn sm" data-req="PATCH /projects/${p.id}" data-body='{"cip_enrolled":true}' data-msg="CIP enrollment recorded">Record CIP enrollment</button>` : ''}
              ${!p.turnover_reviewed ? `<button class="btn sm" data-req="PATCH /projects/${p.id}" data-body='{"turnover_reviewed":true}' data-msg="Turnover review recorded">Record turnover review</button>` : ''}
              <button class="btn sm primary" ${gatesDone ? '' : 'disabled title="CIP + turnover review required"'} data-req="PATCH /projects/${p.id}" data-body='{"status":"execution"}' data-msg="Project moved to execution">Start execution</button>` : ''}
            ${can('projects:update') && p.status === 'execution' ? `<button class="btn sm" data-req="PATCH /projects/${p.id}" data-body='{"status":"closeout"}' data-msg="Moved to closeout">Move to closeout</button>` : ''}
            ${can('projects:close') && p.status === 'closeout' ? `<button class="btn sm primary" data-req="POST /projects/${p.id}/close" data-msg="Project closed">Close project</button>` : ''}
          </div>
          <details class="row-detail">
            <summary>${icon('chevron-right', 'icon icon-sm')} Change orders &amp; invoices</summary>
            <div id="proj-detail-${p.id}" class="detail-body muted">Loading…</div>
          </details>
          ${can('changeorders:create') && p.status === 'execution' ? `
            <form class="grid" id="co-${p.id}" style="margin-top:16px">
              <label class="f full"><span>New change order — description</span><input name="description" required></label>
              <label class="f"><span>Amount ($, +/−)</span><input name="amount" type="number" step="0.01" data-type="number" required></label>
              <div class="form-actions"><button class="btn sm" type="submit">Raise change order</button></div>
            </form>` : ''}
          ${can('invoices:create') && ['execution', 'closeout'].includes(p.status) ? `
            <form class="grid" id="inv-${p.id}" style="margin-top:12px">
              <label class="f full"><span>New invoice — description</span><input name="description"></label>
              <label class="f"><span>Amount ($)</span><input name="amount" type="number" min="0.01" step="0.01" data-type="number" required></label>
              <label class="f"><span>Due date</span><input name="due_date" type="date"></label>
              <div class="form-actions"><button class="btn sm" type="submit">Submit invoice</button></div>
            </form>` : ''}
        </div>
      </div>`;
    }).join('') : emptyState({ title: 'No projects yet', hint: 'Win a bid to create a project.', icon: 'folder-kanban' })}
    </div>
  `, { title: 'Projects' });

  if (state.globalSearch) {
    const s = document.getElementById('list-search');
    if (s) s.value = state.globalSearch;
  }
  bindListFilter({ rowSelector: '.filter-row' });

  for (const p of projects) {
    const details = document.querySelector(`#proj-detail-${p.id}`)?.closest('details');
    details?.addEventListener('toggle', async () => {
      if (!details.open) return;
      const el = document.getElementById(`proj-detail-${p.id}`);
      try {
        const full = await api(`/projects/${p.id}`);
        el.className = 'detail-body';
        el.innerHTML = `
          <div class="table-wrap">
          <table class="data"><thead><tr><th>Type</th><th>Description</th><th class="num">Amount</th><th>By</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          ${full.change_orders.map(c => `<tr>
            <td class="mono">CO-${c.id}</td>
            <td>${esc(c.description)}</td>
            <td class="num">${money(c.amount)}</td>
            <td>${esc(c.created_by_name)}</td>
            <td>${badge(c.status)}</td>
            <td>${can('changeorders:approve') && c.status === 'pending' ? `
              <div class="btn-row">
                <button class="btn sm primary" data-req="POST /projects/change-orders/${c.id}/decision" data-body='{"decision":"approved"}' data-msg="Change order approved">Approve</button>
                <button class="btn sm danger" data-req="POST /projects/change-orders/${c.id}/decision" data-body='{"decision":"rejected"}' data-msg="Change order rejected">Reject</button>
              </div>` : ''}</td>
          </tr>`).join('')}
          ${full.invoices.map(i => `<tr>
            <td class="mono">INV-${i.id}</td>
            <td>${esc(i.description) || '—'}</td>
            <td class="num">${money(i.amount)}</td>
            <td>${esc(i.created_by_name)}</td>
            <td>${badge(i.status)}</td>
            <td>${can('invoices:approve') ? `<div class="btn-row">
              ${i.status === 'submitted' ? `<button class="btn sm primary" data-req="POST /projects/invoices/${i.id}/status" data-body='{"status":"approved"}' data-msg="Invoice approved">Approve</button>` : ''}
              ${i.status === 'approved' ? `<button class="btn sm" data-req="POST /projects/invoices/${i.id}/status" data-body='{"status":"paid"}' data-msg="Invoice marked paid">Mark paid</button>` : ''}
            </div>` : ''}</td>
          </tr>`).join('')}
          ${!full.change_orders.length && !full.invoices.length
            ? `<tr><td colspan="6">${emptyState({ title: 'Nothing recorded yet', hint: 'Raise a change order or invoice to begin.', icon: 'inbox', compact: true })}</td></tr>`
            : ''}
          </tbody></table></div>`;
      } catch (e) {
        el.textContent = e.message;
      }
    });
    bindForm(`co-${p.id}`, async body => {
      await api(`/projects/${p.id}/change-orders`, { method: 'POST', body });
      toast('Change order raised');
      window.render?.();
    });
    bindForm(`inv-${p.id}`, async body => {
      await api(`/projects/${p.id}/invoices`, { method: 'POST', body });
      toast('Invoice submitted');
      window.render?.();
    });
  }
}
