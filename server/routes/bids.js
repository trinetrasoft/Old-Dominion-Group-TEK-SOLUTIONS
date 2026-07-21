const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { P } = require('../rbac');
const { HttpError, requirePermission, validate, audit, asyncH } = require('../middleware/core');

const router = express.Router();

// Stage 2 state machine: draft -> in_review -> submitted -> won | lost
const TRANSITIONS = { draft: ['in_review'], in_review: ['draft', 'submitted'], submitted: ['won', 'lost'], won: [], lost: [] };

const total = b => (b.labor_cost + b.material_cost + b.sub_cost) * (1 + b.margin_pct / 100);

router.get('/', requirePermission(P.BID_READ), (req, res) => {
  res.json(db.all(`
    SELECT b.*, o.title AS opportunity_title, o.client, u.name AS created_by_name
    FROM bids b JOIN opportunities o ON o.id = b.opportunity_id JOIN users u ON u.id = b.created_by
    ORDER BY b.created_at DESC`));
});

const bodySchema = z.object({
  opportunity_id: z.number().int().positive(),
  scope_summary: z.string().max(5000).default(''),
  labor_cost: z.number().nonnegative().default(0),
  material_cost: z.number().nonnegative().default(0),
  sub_cost: z.number().nonnegative().default(0),
  margin_pct: z.number().min(0).max(100).default(15),
  risk_notes: z.string().max(5000).default(''),
});

router.post('/', requirePermission(P.BID_CREATE), validate(bodySchema), asyncH(async (req, res) => {
  const b = req.body;
  const opp = db.get('SELECT * FROM opportunities WHERE id = ?', b.opportunity_id);
  if (!opp) throw new HttpError(404, 'Opportunity not found');
  if (opp.status !== 'go') throw new HttpError(409, 'Bids can only be created for opportunities with a Go decision');
  const r = db.run(
    `INSERT INTO bids (opportunity_id, scope_summary, labor_cost, material_cost, sub_cost, margin_pct, total_price, risk_notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    b.opportunity_id, b.scope_summary, b.labor_cost, b.material_cost, b.sub_cost, b.margin_pct, total(b), b.risk_notes, req.user.id);
  audit(req, 'bid.created', 'bid', Number(r.lastInsertRowid), `opp ${b.opportunity_id}`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));

router.patch('/:id', requirePermission(P.BID_UPDATE),
  validate(bodySchema.partial().omit({ opportunity_id: true })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const bid = db.get('SELECT * FROM bids WHERE id = ?', id);
    if (!bid) throw new HttpError(404, 'Bid not found');
    if (!['draft', 'in_review'].includes(bid.status)) throw new HttpError(409, `Cannot edit a ${bid.status} bid`);

    const merged = { ...bid, ...req.body };
    db.run(
      `UPDATE bids SET scope_summary=?, labor_cost=?, material_cost=?, sub_cost=?, margin_pct=?, total_price=?, risk_notes=?, updated_at=datetime('now') WHERE id=?`,
      merged.scope_summary, merged.labor_cost, merged.material_cost, merged.sub_cost, merged.margin_pct, total(merged), merged.risk_notes, id);
    audit(req, 'bid.updated', 'bid', id);
    res.json({ ok: true });
  }));

// Estimator moves draft <-> in_review -> submitted (deck 2.8-2.11)
router.post('/:id/status', requirePermission(P.BID_SUBMIT),
  validate(z.object({ status: z.enum(['in_review', 'draft', 'submitted']) })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const bid = db.get('SELECT * FROM bids WHERE id = ?', id);
    if (!bid) throw new HttpError(404, 'Bid not found');
    if (!TRANSITIONS[bid.status].includes(req.body.status)) {
      throw new HttpError(409, `Cannot move from ${bid.status} to ${req.body.status}`);
    }
    db.run("UPDATE bids SET status = ?, submitted_at = CASE WHEN ? = 'submitted' THEN datetime('now') ELSE submitted_at END, updated_at = datetime('now') WHERE id = ?",
      req.body.status, req.body.status, id);
    audit(req, `bid.${req.body.status}`, 'bid', id);
    res.json({ ok: true });
  }));

// Management records the client's award decision; a win creates the project (deck 3.1-3.2)
router.post('/:id/award', requirePermission(P.BID_AWARD),
  validate(z.object({ outcome: z.enum(['won', 'lost']) })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const bid = db.get('SELECT b.*, o.title, o.client FROM bids b JOIN opportunities o ON o.id = b.opportunity_id WHERE b.id = ?', id);
    if (!bid) throw new HttpError(404, 'Bid not found');
    if (bid.status !== 'submitted') throw new HttpError(409, 'Only submitted bids can be decided');

    const result = db.tx(() => {
      db.run("UPDATE bids SET status = ?, updated_at = datetime('now') WHERE id = ?", req.body.outcome, id);
      if (req.body.outcome === 'won') {
        const r = db.run('INSERT INTO projects (bid_id, name, client, contract_value) VALUES (?,?,?,?)',
          id, bid.title, bid.client, bid.total_price);
        return { project_id: Number(r.lastInsertRowid) };
      }
      return {};
    });
    audit(req, `bid.${req.body.outcome}`, 'bid', id, result.project_id ? `project ${result.project_id} created` : null);
    res.json({ ok: true, ...result });
  }));

module.exports = router;
