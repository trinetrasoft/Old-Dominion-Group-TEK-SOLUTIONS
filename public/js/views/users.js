import { api, bindForm, esc } from '../api.js';
import { can, state } from '../state.js';
import { shell, showSkeleton } from '../shell.js';
import { pageHeader } from '../ui/page-header.js';
import { dataTable } from '../ui/table.js';
import { badge, activeBadge } from '../ui/badge.js';
import { skeletonTable } from '../ui/skeleton.js';
import { searchField, bindListFilter } from '../ui/search.js';
import { filterSelect } from '../ui/filters.js';
import { toast } from '../ui/toast.js';
import { icon } from '../icons.js';

export async function viewUsers() {
  showSkeleton(pageHeader('Users', 'Accounts and role assignments — RBAC is enforced server-side') + skeletonTable());
  const users = await api('/users');
  const canManage = can('users:manage');
  const roles = ['admin', 'management', 'coordinator', 'estimator', 'procurement', 'project_manager', 'accounting', 'vendor'];

  shell(`
    ${pageHeader('Users', 'Accounts and role assignments — RBAC is enforced server-side')}
    ${canManage ? `
    <div class="panel">
      <div class="panel-head"><h3>${icon('plus', 'icon icon-sm')} Create user</h3></div>
      <div class="panel-body">
        <form class="grid" id="user-form">
          <label class="f"><span>Name</span><input name="name" required></label>
          <label class="f"><span>Email</span><input name="email" type="email" required></label>
          <label class="f"><span>Role</span><select name="role">${roles.map(r => `<option>${r}</option>`).join('')}</select></label>
          <label class="f"><span>Temp password (min 10 chars)</span><input name="password" type="text" minlength="10" required></label>
          <label class="f"><span>Vendor ID (vendor role only)</span><input name="vendor_id" type="number" min="1" data-type="number"></label>
          <div class="form-actions"><button class="btn primary" type="submit">${icon('plus', 'icon icon-sm')} Create user</button></div>
        </form>
      </div>
    </div>` : ''}
    <div class="toolbar">
      ${searchField({ placeholder: 'Search users…' })}
      ${filterSelect({ id: 'list-filter', label: 'Role', options: roles, allLabel: 'All roles' })}
    </div>
    ${dataTable({
      cols: [{ h: '#' }, { h: 'Name' }, { h: 'Email' }, { h: 'Role' }, { h: 'Status' }, { h: 'Actions' }],
      emptyTitle: 'No users',
      emptyHint: 'Create an account to grant platform access.',
      emptyIcon: 'users',
      rows: users.map(u => `<tr class="filter-row" data-filter="${esc(u.role)}">
        <td class="mono">${u.id}</td>
        <td><strong>${esc(u.name)}</strong>${u.vendor_company ? `<div class="muted" style="font-size:12.5px">${esc(u.vendor_company)}</div>` : ''}</td>
        <td class="mono" style="font-size:12.5px">${esc(u.email)}</td>
        <td>${badge(u.role)}</td>
        <td>${activeBadge(u.is_active)}</td>
        <td>${canManage && u.id !== state.user.id
          ? `<button class="btn sm ${u.is_active ? 'danger' : ''}" data-req="PATCH /users/${u.id}" data-body='{"is_active":${u.is_active ? 'false' : 'true'}}' data-msg="User ${u.is_active ? 'deactivated' : 'reactivated'}">${u.is_active ? 'Deactivate' : 'Reactivate'}</button>`
          : ''}</td>
      </tr>`),
    })}
  `, { title: 'Users' });

  if (state.globalSearch) {
    const s = document.getElementById('list-search');
    if (s) s.value = state.globalSearch;
  }
  bindListFilter({ rowSelector: '.filter-row' });
  bindForm('user-form', async body => {
    await api('/users', { method: 'POST', body });
    toast('User created');
    window.render?.();
  });
}
