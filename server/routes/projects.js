const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { P } = require('../rbac');
const { HttpError, requirePermission, validate, audit, asyncH } = require('../middleware/core');

const router = express.Router();

// Stages 3-5: initiation -> execution -> closeout -> closed
const TRANSITIONS = { initiation: ['execution'], execution: ['closeout'], closeout: ['closed'], closed: [] };

router.get('/', requirePermission(P.PROJ_READ), (req, res) => {
  res.json(db.all(`
    SELECT p.*, u.name AS pm_name,
      (SELECT COALESCE(SUM(amount),0) FROM change_orders c WHERE c.project_id = p.id AND c.status = 'approved') AS approved_co_total,
      (SELECT COALESCE(SUM(amount),0) FROM invoices i WHERE i.project_id = p.id AND i.status IN ('approved','paid')) AS billed_total,
      (SELECT COUNT(*) FROM change_orders c WHERE c.project_id = p.id AND c.status = 'pending') AS pending_cos
    FROM projects p LEFT JOIN users u ON u.id = p.pm_id ORDER BY p.created_at DESC`));
});

router.get('/:id', requirePermission(P.PROJ_READ), (req, res) => {
  const p = db.get('SELECT * FROM projects WHERE id = ?', Number(req.params.id));
  if (!p) throw new HttpError(404, 'Project not found');
  res.json({
    ...p,
    change_orders: db.all('SELECT c.*, u.name AS created_by_name FROM change_orders c JOIN users u ON u.id = c.created_by WHERE c.project_id = ? ORDER BY c.id DESC', p.id),
    invoices: db.all('SELECT i.*, u.name AS created_by_name FROM invoices i JOIN users u ON u.id = i.created_by WHERE i.project_id = ? ORDER BY i.id DESC', p.id),
  });
});

router.post('/', requirePermission(P.PROJ_CREATE),
  validate(z.object({
    name: z.string().min(1).max(200),
    client: z.string().min(1).max(200),
    contract_value: z.number().nonnegative().default(0),
    pm_id: z.number().int().positive().optional(),
    start_date: z.string().optional(),
  })),
  asyncH(async (req, res) => {
    const b = req.body;
    const r = db.run('INSERT INTO projects (name, client, contract_value, pm_id, start_date) VALUES (?,?,?,?,?)',
      b.name, b.client, b.contract_value, b.pm_id ?? null, b.start_date ?? null);
    audit(req, 'project.created', 'project', Number(r.lastInsertRowid), b.name);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  }));

router.patch('/:id', requirePermission(P.PROJ_UPDATE),
  validate(z.object({
    name: z.string().min(1).max(200).optional(),
    pm_id: z.number().int().positive().nullable().optional(),
    status: z.enum(['execution', 'closeout']).optional(),
    cip_enrolled: z.boolean().optional(),
    turnover_reviewed: z.boolean().optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
  })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const p = db.get('SELECT * FROM projects WHERE id = ?', id);
    if (!p) throw new HttpError(404, 'Project not found');
    if (p.status === 'closed') throw new HttpError(409, 'Project is closed');

    const fields = { ...req.body };
    if (fields.status) {
      if (!TRANSITIONS[p.status].includes(fields.status)) throw new HttpError(409, `Cannot move from ${p.status} to ${fields.status}`);
      // Deck 3.4-3.6: initiation gates — CIP enrollment + turnover review before execution.
      if (fields.status === 'execution') {
        const cip = fields.cip_enrolled ?? !!p.cip_enrolled;
        const turnover = fields.turnover_reviewed ?? !!p.turnover_reviewed;
        if (!cip || !turnover) throw new HttpError(409, 'CIP enrollment and turnover review must be complete before execution');
      }
    }
    for (const [k, v] of Object.entries(fields)) {
      const val = typeof v === 'boolean' ? (v ? 1 : 0) : v;
      db.run(`UPDATE projects SET ${k} = ?, updated_at = datetime('now') WHERE id = ?`, val ?? null, id);
    }
    audit(req, 'project.updated', 'project', id, JSON.stringify(Object.keys(fields)));
    res.json({ ok: true });
  }));

// Close out — Management only. Requires no pending change orders or unapproved invoices (deck 5.8).
router.post('/:id/close', requirePermission(P.PROJ_CLOSE), asyncH(async (req, res) => {
  const id = Number(req.params.id);
  const p = db.get('SELECT * FROM projects WHERE id = ?', id);
  if (!p) throw new HttpError(404, 'Project not found');
  if (p.status !== 'closeout') throw new HttpError(409, 'Project must be in closeout first');
  const pendingCo = db.get("SELECT COUNT(*) AS n FROM change_orders WHERE project_id = ? AND status = 'pending'", id).n;
  const openInv = db.get("SELECT COUNT(*) AS n FROM invoices WHERE project_id = ? AND status IN ('draft','submitted')", id).n;
  if (pendingCo || openInv) throw new HttpError(409, `Resolve ${pendingCo} pending change order(s) and ${openInv} open invoice(s) first`);
  db.run("UPDATE projects SET status = 'closed', end_date = COALESCE(end_date, date('now')), updated_at = datetime('now') WHERE id = ?", id);
  audit(req, 'project.closed', 'project', id);
  res.json({ ok: true });
}));

/* ---------- Change orders (deck 4.10: timely CO management) ---------- */

router.post('/:id/change-orders', requirePermission(P.CO_CREATE),
  validate(z.object({ description: z.string().min(1).max(2000), amount: z.number() })),
  asyncH(async (req, res) => {
    const p = db.get('SELECT * FROM projects WHERE id = ?', Number(req.params.id));
    if (!p) throw new HttpError(404, 'Project not found');
    if (p.status !== 'execution') throw new HttpError(409, 'Change orders can only be raised during execution');
    const r = db.run('INSERT INTO change_orders (project_id, description, amount, created_by) VALUES (?,?,?,?)',
      p.id, req.body.description, req.body.amount, req.user.id);
    audit(req, 'changeorder.created', 'change_order', Number(r.lastInsertRowid), `project ${p.id} amount ${req.body.amount}`);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  }));

// Approval is management-only and adjusts contract value — segregation of duties.
router.post('/change-orders/:coId/decision', requirePermission(P.CO_APPROVE),
  validate(z.object({ decision: z.enum(['approved', 'rejected']) })),
  asyncH(async (req, res) => {
    const co = db.get('SELECT * FROM change_orders WHERE id = ?', Number(req.params.coId));
    if (!co) throw new HttpError(404, 'Change order not found');
    if (co.status !== 'pending') throw new HttpError(409, 'Change order already decided');
    if (co.created_by === req.user.id) throw new HttpError(403, 'You cannot approve your own change order');
    db.tx(() => {
      db.run('UPDATE change_orders SET status = ?, decided_by = ? WHERE id = ?', req.body.decision, req.user.id, co.id);
      if (req.body.decision === 'approved') {
        db.run("UPDATE projects SET contract_value = contract_value + ?, updated_at = datetime('now') WHERE id = ?", co.amount, co.project_id);
      }
    });
    audit(req, `changeorder.${req.body.decision}`, 'change_order', co.id, `amount ${co.amount}`);
    res.json({ ok: true });
  }));

/* ---------- Invoices (deck 5.3-5.6: billing & prompt collection) ---------- */

router.post('/:id/invoices', requirePermission(P.INV_CREATE),
  validate(z.object({ amount: z.number().positive(), description: z.string().max(2000).default(''), due_date: z.string().optional() })),
  asyncH(async (req, res) => {
    const p = db.get('SELECT * FROM projects WHERE id = ?', Number(req.params.id));
    if (!p) throw new HttpError(404, 'Project not found');
    if (!['execution', 'closeout'].includes(p.status)) throw new HttpError(409, 'Invoices can only be raised during execution or closeout');
    const r = db.run("INSERT INTO invoices (project_id, amount, description, due_date, status, created_by) VALUES (?,?,?,?,'submitted',?)",
      p.id, req.body.amount, req.body.description, req.body.due_date ?? null, req.user.id);
    audit(req, 'invoice.created', 'invoice', Number(r.lastInsertRowid), `project ${p.id} amount ${req.body.amount}`);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  }));

// Approve / mark paid — Accounting only. Maker-checker enforced.
router.post('/invoices/:invId/status', requirePermission(P.INV_APPROVE),
  validate(z.object({ status: z.enum(['approved', 'paid']) })),
  asyncH(async (req, res) => {
    const inv = db.get('SELECT * FROM invoices WHERE id = ?', Number(req.params.invId));
    if (!inv) throw new HttpError(404, 'Invoice not found');
    const flow = { submitted: 'approved', approved: 'paid' };
    if (flow[inv.status] !== req.body.status) throw new HttpError(409, `Invoice is ${inv.status}; next state is ${flow[inv.status] || 'none'}`);
    if (inv.created_by === req.user.id) throw new HttpError(403, 'You cannot approve an invoice you created');
    db.run('UPDATE invoices SET status = ?, approved_by = ? WHERE id = ?', req.body.status, req.user.id, inv.id);
    audit(req, `invoice.${req.body.status}`, 'invoice', inv.id, `amount ${inv.amount}`);
    res.json({ ok: true });
  }));

module.exports = router;
