const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { P } = require('../rbac');
const { HttpError, requirePermission, validate, audit, asyncH } = require('../middleware/core');

const router = express.Router();

// Vendor pipeline: invited -> onboarding -> compliance_review -> approved | rejected (approved <-> suspended)
const TRANSITIONS = {
  invited: ['onboarding'], onboarding: ['compliance_review'],
  compliance_review: ['approved', 'rejected'],
  approved: ['suspended'], suspended: ['approved'], rejected: [],
};

router.get('/', requirePermission(P.VENDOR_READ), (req, res) => {
  res.json(db.all('SELECT * FROM vendors ORDER BY created_at DESC'));
});

const vendorSchema = z.object({
  company: z.string().min(1).max(200),
  contact_name: z.string().max(120).default(''),
  contact_email: z.string().email().or(z.literal('')).default(''),
  trade: z.string().max(120).default(''),
  notes: z.string().max(5000).default(''),
});

router.post('/', requirePermission(P.VENDOR_CREATE), validate(vendorSchema), asyncH(async (req, res) => {
  const b = req.body;
  const r = db.run('INSERT INTO vendors (company, contact_name, contact_email, trade, notes, created_by) VALUES (?,?,?,?,?,?)',
    b.company, b.contact_name, b.contact_email, b.trade, b.notes, req.user.id);
  audit(req, 'vendor.invited', 'vendor', Number(r.lastInsertRowid), b.company);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));

router.patch('/:id', requirePermission(P.VENDOR_UPDATE),
  validate(vendorSchema.partial().extend({
    status: z.enum(['onboarding', 'compliance_review', 'suspended', 'approved']).optional(),
    insurance_ok: z.boolean().optional(),
    legal_ok: z.boolean().optional(),
    financial_ok: z.boolean().optional(),
    score_quality: z.number().min(0).max(5).nullable().optional(),
    score_delivery: z.number().min(0).max(5).nullable().optional(),
    score_pricing: z.number().min(0).max(5).nullable().optional(),
  })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const vendor = db.get('SELECT * FROM vendors WHERE id = ?', id);
    if (!vendor) throw new HttpError(404, 'Vendor not found');

    const fields = { ...req.body };
    if (fields.status) {
      if (!TRANSITIONS[vendor.status].includes(fields.status)) {
        throw new HttpError(409, `Cannot move from ${vendor.status} to ${fields.status}`);
      }
      // Final approval is a separate, management-gated action.
      if (fields.status === 'approved' && vendor.status === 'compliance_review') {
        throw new HttpError(409, 'Use the approval endpoint for final approval');
      }
    }
    for (const [k, v] of Object.entries(fields)) {
      const val = typeof v === 'boolean' ? (v ? 1 : 0) : v;
      db.run(`UPDATE vendors SET ${k} = ?, updated_at = datetime('now') WHERE id = ?`, val ?? null, id);
    }
    audit(req, 'vendor.updated', 'vendor', id, JSON.stringify(Object.keys(fields)));
    res.json({ ok: true });
  }));

// Approve/reject after compliance — Management only. Full compliance checklist enforced (deck: risk/compliance/legal pipeline).
router.post('/:id/decision', requirePermission(P.VENDOR_APPROVE),
  validate(z.object({ decision: z.enum(['approved', 'rejected']), notes: z.string().max(2000).default('') })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const vendor = db.get('SELECT * FROM vendors WHERE id = ?', id);
    if (!vendor) throw new HttpError(404, 'Vendor not found');
    if (vendor.status !== 'compliance_review') throw new HttpError(409, `Vendor must be in compliance_review (currently ${vendor.status})`);
    if (req.body.decision === 'approved' && !(vendor.insurance_ok && vendor.legal_ok && vendor.financial_ok)) {
      throw new HttpError(409, 'All compliance checks (insurance, legal, financial) must pass before approval');
    }
    db.run("UPDATE vendors SET status = ?, notes = notes || ? , updated_at = datetime('now') WHERE id = ?",
      req.body.decision, req.body.notes ? `\n[decision] ${req.body.notes}` : '', id);
    audit(req, `vendor.${req.body.decision}`, 'vendor', id, req.body.notes);
    res.json({ ok: true });
  }));

/* ---------- Syndicated bid solicitations (push model) ---------- */

// Vendors see only open solicitations matching flow; staff see all with responses.
router.get('/solicitations/all', requirePermission(P.SOL_READ), (req, res) => {
  if (req.user.role === 'vendor') {
    const rows = db.all(`
      SELECT s.id, s.title, s.scope, s.trade, s.due_date, s.status,
             (SELECT status FROM solicitation_responses r WHERE r.solicitation_id = s.id AND r.vendor_id = ?) AS my_response_status,
             (SELECT price  FROM solicitation_responses r WHERE r.solicitation_id = s.id AND r.vendor_id = ?) AS my_price
      FROM solicitations s WHERE s.status != 'closed' ORDER BY s.created_at DESC`,
      req.user.vendor_id, req.user.vendor_id);
    return res.json(rows);
  }
  const rows = db.all('SELECT s.*, u.name AS created_by_name FROM solicitations s JOIN users u ON u.id = s.created_by ORDER BY s.created_at DESC');
  for (const s of rows) {
    s.responses = db.all(`
      SELECT r.*, v.company FROM solicitation_responses r JOIN vendors v ON v.id = r.vendor_id
      WHERE r.solicitation_id = ? ORDER BY r.price ASC`, s.id);
  }
  res.json(rows);
});

router.post('/solicitations', requirePermission(P.SOL_CREATE),
  validate(z.object({
    title: z.string().min(1).max(200),
    scope: z.string().max(5000).default(''),
    trade: z.string().max(120).default(''),
    due_date: z.string().optional(),
    opportunity_id: z.number().int().positive().optional(),
    project_id: z.number().int().positive().optional(),
  })),
  asyncH(async (req, res) => {
    const b = req.body;
    const r = db.run('INSERT INTO solicitations (title, scope, trade, due_date, opportunity_id, project_id, created_by) VALUES (?,?,?,?,?,?,?)',
      b.title, b.scope, b.trade, b.due_date ?? null, b.opportunity_id ?? null, b.project_id ?? null, req.user.id);
    audit(req, 'solicitation.created', 'solicitation', Number(r.lastInsertRowid), b.title);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  }));

// Vendor submits a quote against a solicitation — scoped to own vendor_id.
router.post('/solicitations/:id/respond', requirePermission(P.SOL_RESPOND),
  validate(z.object({ price: z.number().positive(), lead_time_days: z.number().int().positive().optional(), exclusions: z.string().max(2000).default('') })),
  asyncH(async (req, res) => {
    if (!req.user.vendor_id) throw new HttpError(403, 'Account is not linked to a vendor company');
    const vendor = db.get('SELECT status FROM vendors WHERE id = ?', req.user.vendor_id);
    if (vendor?.status !== 'approved') throw new HttpError(403, 'Only approved vendors can respond to solicitations');
    const sol = db.get('SELECT * FROM solicitations WHERE id = ?', Number(req.params.id));
    if (!sol) throw new HttpError(404, 'Solicitation not found');
    if (sol.status !== 'open') throw new HttpError(409, 'Solicitation is no longer open');
    if (db.get('SELECT id FROM solicitation_responses WHERE solicitation_id = ? AND vendor_id = ?', sol.id, req.user.vendor_id)) {
      throw new HttpError(409, 'Your company has already responded');
    }
    const b = req.body;
    const r = db.run('INSERT INTO solicitation_responses (solicitation_id, vendor_id, price, lead_time_days, exclusions) VALUES (?,?,?,?,?)',
      sol.id, req.user.vendor_id, b.price, b.lead_time_days ?? null, b.exclusions);
    audit(req, 'solicitation.response', 'solicitation', sol.id, `vendor ${req.user.vendor_id} @ ${b.price}`);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  }));

// Award to one response, decline the rest (deck: bid comparison & transparent selection).
router.post('/solicitations/:id/award', requirePermission(P.SOL_AWARD),
  validate(z.object({ response_id: z.number().int().positive() })),
  asyncH(async (req, res) => {
    const sol = db.get('SELECT * FROM solicitations WHERE id = ?', Number(req.params.id));
    if (!sol) throw new HttpError(404, 'Solicitation not found');
    if (sol.status !== 'open') throw new HttpError(409, 'Solicitation is not open');
    const resp = db.get('SELECT * FROM solicitation_responses WHERE id = ? AND solicitation_id = ?', req.body.response_id, sol.id);
    if (!resp) throw new HttpError(404, 'Response not found for this solicitation');

    db.tx(() => {
      db.run("UPDATE solicitation_responses SET status = 'declined' WHERE solicitation_id = ? AND id != ?", sol.id, resp.id);
      db.run("UPDATE solicitation_responses SET status = 'awarded' WHERE id = ?", resp.id);
      db.run("UPDATE solicitations SET status = 'awarded', awarded_response = ? WHERE id = ?", resp.id, sol.id);
    });
    audit(req, 'solicitation.awarded', 'solicitation', sol.id, `response ${resp.id}, vendor ${resp.vendor_id}`);
    res.json({ ok: true });
  }));

module.exports = router;
