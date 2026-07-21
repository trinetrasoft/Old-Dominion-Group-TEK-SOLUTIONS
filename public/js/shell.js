import { state, can, toggleSidebarCollapsed } from './state.js';
import { icon, initials } from './icons.js';
import { logout } from './api.js';
import { esc } from './api.js';

export const NAV = [
  ['#/dashboard', 'Dashboard', 'layout-dashboard', () => true],
  ['#/opportunities', 'Opportunities', 'briefcase', () => can('opportunities:read')],
  ['#/bids', 'Bids & Estimates', 'file-text', () => can('bids:read')],
  ['#/vendors', 'Vendor Portal', 'building-2', () => can('vendors:read')],
  ['#/solicitations', 'Solicitations', 'send', () => can('solicitations:read')],
  ['#/projects', 'Projects', 'folder-kanban', () => can('projects:read')],
  ['#/users', 'Users', 'user-cog', () => can('users:read')],
  ['#/audit', 'Audit Log', 'scroll-text', () => can('audit:read')],
];

const TITLES = Object.fromEntries(NAV.map(([href, label]) => [href, label]));

export function shell(content, { title } = {}) {
  const app = document.getElementById('app');
  const route = location.hash || '#/dashboard';
  const pageTitle = title || TITLES[Object.keys(TITLES).find(r => route.startsWith(r))] || 'Operations';
  const collapsed = state.sidebarCollapsed;
  const mobileOpen = document.documentElement.dataset.sidebarOpen === '1';

  app.innerHTML = `
  <div class="app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-open' : ''}" id="app-shell">
    <div class="sidebar-backdrop" id="sidebar-backdrop" hidden></div>
    <aside class="sidebar" id="sidebar" aria-label="Primary">
      <div class="sidebar-brand">
        <div class="brand-mark" aria-hidden="true">ODG</div>
        <div class="brand-text">
          <strong>ODG Operations</strong>
          <span>Enterprise platform</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${NAV.filter(([, , , ok]) => ok()).map(([href, label, ic]) => `
          <a class="nav-item ${route.startsWith(href) ? 'active' : ''}" href="${href}" title="${esc(label)}">
            ${icon(ic)}
            <span class="nav-label">${esc(label)}</span>
          </a>`).join('')}
      </nav>
      <div class="sidebar-foot">
        <button class="btn ghost sm" id="collapse-sidebar" style="width:100%;justify-content:flex-start" title="Collapse sidebar">
          ${icon('panel-left', 'icon icon-sm')}
          <span class="sidebar-foot-text">Collapse</span>
        </button>
      </div>
    </aside>
    <header class="topbar">
      <div class="topbar-left">
        <button class="icon-btn" id="mobile-menu" aria-label="Open menu" aria-expanded="false">
          ${icon('menu')}
        </button>
        <div class="topbar-title">${esc(pageTitle)}</div>
      </div>
      <div class="topbar-search">
        <div class="search-field">
          ${icon('search', 'icon icon-sm')}
          <label class="sr-only" for="global-search">Search</label>
          <input id="global-search" type="search" placeholder="Filter current page…" value="${esc(state.globalSearch)}" autocomplete="off">
        </div>
      </div>
      <div class="topbar-right">
        <div class="user-chip">
          <div class="user-meta">
            <span class="user-name">${esc(state.user.name)}</span>
            <span class="user-role">${esc(state.user.role.replace(/_/g, ' '))}</span>
          </div>
          <div class="avatar" aria-hidden="true">${esc(initials(state.user.name))}</div>
          <button class="icon-btn" id="logout-btn" title="Sign out" aria-label="Sign out">
            ${icon('log-out', 'icon icon-sm')}
          </button>
        </div>
      </div>
    </header>
    <main class="main" id="main" role="main">${content}</main>
  </div>`;

  wireShell();
}

function wireShell() {
  const shellEl = document.getElementById('app-shell');
  const backdrop = document.getElementById('sidebar-backdrop');

  document.getElementById('logout-btn')?.addEventListener('click', () => logout());

  document.getElementById('collapse-sidebar')?.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 900px)').matches) {
      closeMobile();
      return;
    }
    toggleSidebarCollapsed();
    shellEl.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
  });

  const openMobile = () => {
    document.documentElement.dataset.sidebarOpen = '1';
    shellEl.classList.add('sidebar-open');
    backdrop.hidden = false;
    document.getElementById('mobile-menu')?.setAttribute('aria-expanded', 'true');
  };

  const closeMobile = () => {
    document.documentElement.dataset.sidebarOpen = '0';
    shellEl.classList.remove('sidebar-open');
    backdrop.hidden = true;
    document.getElementById('mobile-menu')?.setAttribute('aria-expanded', 'false');
  };

  document.getElementById('mobile-menu')?.addEventListener('click', () => {
    if (shellEl.classList.contains('sidebar-open')) closeMobile();
    else openMobile();
  });

  backdrop?.addEventListener('click', closeMobile);

  document.querySelectorAll('.sidebar .nav-item').forEach(a => {
    a.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 900px)').matches) closeMobile();
    });
  });

  const gs = document.getElementById('global-search');
  gs?.addEventListener('input', () => {
    state.globalSearch = gs.value;
    // Mirror into page search if present
    const pageSearch = document.getElementById('list-search');
    if (pageSearch) {
      pageSearch.value = gs.value;
      pageSearch.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
}

export function showSkeleton(html) {
  shell(html);
}
