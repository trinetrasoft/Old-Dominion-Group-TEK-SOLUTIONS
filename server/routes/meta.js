const express = require('express');
const db = require('../db');
const { P, hasPermission } = require('../rbac');
const { requirePermission } = require('../middleware/core');

const router = express.Router();

// Role-aware dashboard. Vendors get a minimal view; staff get pipeline metrics.
router.get('/dashboard', (req, res) => {
  const role = req.user.role;
  if (role === 'vendor') {
    const open = db.get("SELECT COUNT(*) AS n FROM solicitations WHERE status = 'open'").n;
    const mine = db.get('SELECT COUNT(*) AS n FROM solicitation_responses WHERE vendor_id = ?', req.user.vendor_id ?? -1).n;
    return res.json({ role, cards: [
      { label: 'Open solicitations', value: open },
      { label: 'My responses', value: mine },
    ]});
  }
  const cards = [];
  if (hasPermission(role, P.OPP_READ)) {
    cards.push({ label: 'Opportunities in intake', value: db.get("SELECT COUNT(*) AS n FROM opportunities WHERE status IN ('intake','prequalification')").n });
  }
  if (hasPermission(role, P.BID_READ)) {
    cards.push({ label: 'Bids in progress', value: db.get("SELECT COUNT(*) AS n FROM bids WHERE status IN ('draft','in_review','submitted')").n });
    const w = db.get("SELECT COUNT(*) AS n FROM bids WHERE status='won'").n;
    const l = db.get("SELECT COUNT(*) AS n FROM bids WHERE status='lost'").n;
    cards.push({ label: 'Win rate', value: (w + l) ? `${Math.round(100 * w / (w + l))}%` : '—' });
  }
  if (hasPermission(role, P.VENDOR_READ)) {
    cards.push({ label: 'Approved vendors', value: db.get("SELECT COUNT(*) AS n FROM vendors WHERE status='approved'").n });
    cards.push({ label: 'Vendors in pipeline', value: db.get("SELECT COUNT(*) AS n FROM vendors WHERE status IN ('invited','onboarding','compliance_review')").n });
  }
  if (hasPermission(role, P.PROJ_READ)) {
    cards.push({ label: 'Active projects', value: db.get("SELECT COUNT(*) AS n FROM projects WHERE status IN ('initiation','execution')").n });
    cards.push({ label: 'Contract value (active)', value: '$' + Math.round(db.get("SELECT COALESCE(SUM(contract_value),0) AS v FROM projects WHERE status != 'closed'").v).toLocaleString('en-US') });
  }
  if (hasPermission(role, P.CO_READ)) {
    cards.push({ label: 'Pending change orders', value: db.get("SELECT COUNT(*) AS n FROM change_orders WHERE status='pending'").n });
  }
  if (hasPermission(role, P.INV_READ)) {
    cards.push({ label: 'Invoices awaiting approval', value: db.get("SELECT COUNT(*) AS n FROM invoices WHERE status='submitted'").n });
  }
  // Workflow stage funnel (the deck's 5-stage flow)
  const funnel = {
    intake: db.get("SELECT COUNT(*) AS n FROM opportunities WHERE status IN ('intake','prequalification')").n,
    bidding: db.get("SELECT COUNT(*) AS n FROM bids WHERE status IN ('draft','in_review','submitted')").n,
    initiation: db.get("SELECT COUNT(*) AS n FROM projects WHERE status='initiation'").n,
    execution: db.get("SELECT COUNT(*) AS n FROM projects WHERE status='execution'").n,
    closeout: db.get("SELECT COUNT(*) AS n FROM projects WHERE status='closeout'").n,
  };
  res.json({ role, cards, funnel });
});

router.get('/audit', requirePermission(P.AUDIT_READ), (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '200', 10) || 200, 1000);
  res.json(db.all('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?', limit));
});

module.exports = router;
