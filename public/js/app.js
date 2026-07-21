import { state } from './state.js';
import { tryRefresh, setupActionDelegation } from './api.js';
import { viewLogin } from './views/login.js';
import { viewDashboard } from './views/dashboard.js';
import { viewOpportunities } from './views/opportunities.js';
import { viewBids } from './views/bids.js';
import { viewVendors } from './views/vendors.js';
import { viewSolicitations } from './views/solicitations.js';
import { viewProjects } from './views/projects.js';
import { viewUsers } from './views/users.js';
import { viewAudit } from './views/audit.js';
import { viewError } from './views/error.js';

const ROUTES = {
  '#/dashboard': viewDashboard,
  '#/opportunities': viewOpportunities,
  '#/bids': viewBids,
  '#/vendors': viewVendors,
  '#/solicitations': viewSolicitations,
  '#/projects': viewProjects,
  '#/users': viewUsers,
  '#/audit': viewAudit,
};

async function render() {
  if (!state.user) {
    if (state.refresh && await tryRefresh()) {
      /* session restored */
    } else {
      return viewLogin();
    }
  }

  const route = location.hash || '#/dashboard';
  const key = Object.keys(ROUTES).find(r => route.startsWith(r));
  const view = ROUTES[key] || viewDashboard;

  try {
    await view();
  } catch (e) {
    if (state.user) viewError(e.message);
    else viewLogin();
  }
}

setupActionDelegation();
window.addEventListener('hashchange', render);
window.render = render;
render();
