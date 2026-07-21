/**
 * RBAC matrix derived from ODG's business process flow (deck slides 14-18):
 *  - management            Management / Legal: go/no-go, awards, approvals, oversight
 *  - coordinator           Billing Project Coordinator: intake, prequalification, billing, closeout
 *  - estimator             Estimator: bid development & pricing
 *  - procurement           Construction Procurement Manager: vendors, sourcing, solicitations
 *  - project_manager       Project Manager: execution, change orders, project billing
 *  - accounting            Accounting Specialist: invoice approval, reconciliation, audit review
 *  - vendor                External subcontractor/supplier: own profile + solicitations only
 *  - admin                 IT Support / system administration: everything
 */

const P = {
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  OPP_READ: 'opportunities:read',
  OPP_CREATE: 'opportunities:create',
  OPP_UPDATE: 'opportunities:update',
  OPP_DECIDE: 'opportunities:decide',
  BID_READ: 'bids:read',
  BID_CREATE: 'bids:create',
  BID_UPDATE: 'bids:update',
  BID_SUBMIT: 'bids:submit',
  BID_AWARD: 'bids:award',
  VENDOR_READ: 'vendors:read',
  VENDOR_CREATE: 'vendors:create',
  VENDOR_UPDATE: 'vendors:update',
  VENDOR_APPROVE: 'vendors:approve',
  SOL_READ: 'solicitations:read',
  SOL_CREATE: 'solicitations:create',
  SOL_RESPOND: 'solicitations:respond',
  SOL_AWARD: 'solicitations:award',
  PROJ_READ: 'projects:read',
  PROJ_CREATE: 'projects:create',
  PROJ_UPDATE: 'projects:update',
  PROJ_CLOSE: 'projects:close',
  CO_READ: 'changeorders:read',
  CO_CREATE: 'changeorders:create',
  CO_APPROVE: 'changeorders:approve',
  INV_READ: 'invoices:read',
  INV_CREATE: 'invoices:create',
  INV_APPROVE: 'invoices:approve',
  AUDIT_READ: 'audit:read',
};

const ALL = Object.values(P);

const ROLE_PERMISSIONS = {
  admin: ALL,

  management: [
    P.USERS_READ,
    P.OPP_READ, P.OPP_DECIDE,
    P.BID_READ, P.BID_AWARD,
    P.VENDOR_READ, P.VENDOR_APPROVE,
    P.SOL_READ, P.SOL_AWARD,
    P.PROJ_READ, P.PROJ_CREATE, P.PROJ_CLOSE,
    P.CO_READ, P.CO_APPROVE,
    P.INV_READ,
    P.AUDIT_READ,
  ],

  coordinator: [
    P.OPP_READ, P.OPP_CREATE, P.OPP_UPDATE,
    P.BID_READ,
    P.VENDOR_READ,
    P.SOL_READ,
    P.PROJ_READ, P.PROJ_UPDATE,
    P.CO_READ,
    P.INV_READ, P.INV_CREATE,
  ],

  estimator: [
    P.OPP_READ,
    P.BID_READ, P.BID_CREATE, P.BID_UPDATE, P.BID_SUBMIT,
    P.VENDOR_READ,
    P.SOL_READ,
    P.PROJ_READ,
  ],

  procurement: [
    P.OPP_READ,
    P.BID_READ,
    P.VENDOR_READ, P.VENDOR_CREATE, P.VENDOR_UPDATE,
    P.SOL_READ, P.SOL_CREATE, P.SOL_AWARD,
    P.PROJ_READ,
    P.CO_READ,
  ],

  project_manager: [
    P.OPP_READ,
    P.BID_READ,
    P.VENDOR_READ,
    P.SOL_READ, P.SOL_CREATE,
    P.PROJ_READ, P.PROJ_CREATE, P.PROJ_UPDATE,
    P.CO_READ, P.CO_CREATE,
    P.INV_READ, P.INV_CREATE,
  ],

  accounting: [
    P.USERS_READ,
    P.PROJ_READ,
    P.CO_READ,
    P.INV_READ, P.INV_APPROVE,
    P.AUDIT_READ,
  ],

  vendor: [
    P.SOL_READ, P.SOL_RESPOND,   // scoped to own vendor company in route handlers
  ],
};

const ROLES = Object.keys(ROLE_PERMISSIONS);

function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(role, perm) {
  return permissionsFor(role).includes(perm);
}

module.exports = { P, ROLES, ROLE_PERMISSIONS, permissionsFor, hasPermission };
