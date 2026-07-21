const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { P } = require('../rbac');
const { HttpError, requirePermission, validate, audit, asyncH } = require('../middleware/core');

const router = express.Router();

// Stage 1 state machine: intake -> prequalification -> go | no_go
const TRANSITIONS = { intake: ['prequalification'], prequalification: ['go', 'no_go'], go: [], no_go: [] };

router.get('/', requirePermission(P.OPP_READ), (req, res) => {
  res.json(db.all(`
    SELECT o.*, u.name AS created_by_name, e.name AS estimator_name,
           (SELECT COUNT(*) FROM bids b WHERE b.opportunity_id = o.id) AS bid_count
    FROM opportunities o
    JOIN users u ON u.id = o.created_by
    LEFT JOIN users e ON e.id = o.assigned_estimator
    ORDER BY o.created_at DESC`));
});

router.get('/:id', requirePermission(P.OPP_READ), (req, res) => {
  const opp = db.get('SELECT * FROM opportunities WHERE id = ?', Number(req.params.id));
  if (!opp) throw new HttpError(404, 'Opportunity not found');
  res.json({ ...opp, bids: db.all('SELECT * FROM bids WHERE opportunity_id = ? ORDER BY id DESC', opp.id) });
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  client: z.string().min(1).max(200),
  source: z.enum(['rfq', 'rfp', 'bid_stream', 'referral']).default('rfq'),
  description: z.string().max(5000).default(''),
  est_value: z.number().nonnegative().optional(),
  due_date: z.string().optional(),
});

router.post('/', requirePermission(P.OPP_CREATE), validate(createSchema), asyncH(async (req, res) => {
  const b = req.body;
  const r = db.run(
    'INSERT INTO opportunities (title, client, source, description, est_value, due_date, created_by) VALUES (?,?,?,?,?,?,?)',
    b.title, b.client, b.source, b.description, b.est_value ?? null, b.due_date ?? null, req.user.id);
  audit(req, 'opportunity.created', 'opportunity', Number(r.lastInsertRowid), b.title);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));

router.patch('/:id', requirePermission(P.OPP_UPDATE),
  validate(createSchema.partial().extend({
    status: z.enum(['prequalification']).optional(),
    assigned_estimator: z.number().int().positive().nullable().optional(),
  })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const opp = db.get('SELECT * FROM opportunities WHERE id = ?', id);
    if (!opp) throw new HttpError(404, 'Opportunity not found');
    if (['go', 'no_go'].includes(opp.status)) throw new HttpError(409, 'Opportunity is already decided');

    const fields = { ...req.body };
    if (fields.status && !TRANSITIONS[opp.status].includes(fields.status)) {
      throw new HttpError(409, `Cannot move from ${opp.status} to ${fields.status}`);
    }
    if (fields.assigned_estimator) {
      const est = db.get('SELECT role FROM users WHERE id = ? AND is_active = 1', fields.assigned_estimator);
      if (!est || !['estimator', 'admin'].includes(est.role)) throw new HttpError(400, 'assigned_estimator must be an active estimator');
    }
    for (const [k, v] of Object.entries(fields)) {
      db.run(`UPDATE opportunities SET ${k} = ?, updated_at = datetime('now') WHERE id = ?`, v ?? null, id);
    }
    audit(req, 'opportunity.updated', 'opportunity', id, JSON.stringify(Object.keys(fields)));
    res.json({ ok: true });
  }));

// Go/No-Go decision — Management only (deck step 1.4)
router.post('/:id/decision', requirePermission(P.OPP_DECIDE),
  validate(z.object({ decision: z.enum(['go', 'no_go']), notes: z.string().max(2000).default('') })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const opp = db.get('SELECT * FROM opportunities WHERE id = ?', id);
    if (!opp) throw new HttpError(404, 'Opportunity not found');
    if (!TRANSITIONS[opp.status].includes(req.body.decision)) {
      throw new HttpError(409, `Opportunity must be in prequalification (currently ${opp.status})`);
    }
    db.run("UPDATE opportunities SET status = ?, decision_notes = ?, updated_at = datetime('now') WHERE id = ?",
      req.body.decision, req.body.notes, id);
    audit(req, `opportunity.${req.body.decision}`, 'opportunity', id, req.body.notes);
    res.json({ ok: true });
  }));

module.exports = router;
