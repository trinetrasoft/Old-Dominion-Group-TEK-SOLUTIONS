const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const { P, ROLES } = require('../rbac');
const { HttpError, requirePermission, validate, audit, asyncH } = require('../middleware/core');

const router = express.Router();

router.get('/', requirePermission(P.USERS_READ), (req, res) => {
  res.json(db.all(`SELECT u.id, u.email, u.name, u.role, u.is_active, u.created_at, v.company AS vendor_company
                   FROM users u LEFT JOIN vendors v ON v.id = u.vendor_id ORDER BY u.id`));
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(ROLES),
  password: z.string().min(10).max(128),
  vendor_id: z.number().int().positive().optional(),
});

router.post('/', requirePermission(P.USERS_MANAGE), validate(createSchema), asyncH(async (req, res) => {
  const { email, name, role, password, vendor_id } = req.body;
  if (role === 'vendor' && !vendor_id) throw new HttpError(400, 'vendor role requires vendor_id');
  if (db.get('SELECT id FROM users WHERE email = ?', email)) throw new HttpError(409, 'Email already registered');
  const hash = await bcrypt.hash(password, 12);
  const r = db.run('INSERT INTO users (email, name, role, password_hash, vendor_id) VALUES (?,?,?,?,?)',
    email, name, role, hash, vendor_id ?? null);
  audit(req, 'user.created', 'user', Number(r.lastInsertRowid), `${email} as ${role}`);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));

router.patch('/:id', requirePermission(P.USERS_MANAGE),
  validate(z.object({
    name: z.string().min(1).max(120).optional(),
    role: z.enum(ROLES).optional(),
    is_active: z.boolean().optional(),
    password: z.string().min(10).max(128).optional(),
  })),
  asyncH(async (req, res) => {
    const id = Number(req.params.id);
    const user = db.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) throw new HttpError(404, 'User not found');
    if (id === req.user.id && req.body.is_active === false) throw new HttpError(400, 'Cannot deactivate your own account');

    const { name, role, is_active, password } = req.body;
    if (name !== undefined) db.run('UPDATE users SET name = ? WHERE id = ?', name, id);
    if (role !== undefined) db.run('UPDATE users SET role = ? WHERE id = ?', role, id);
    if (is_active !== undefined) {
      db.run('UPDATE users SET is_active = ? WHERE id = ?', is_active ? 1 : 0, id);
      if (!is_active) db.run('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', id);
    }
    if (password !== undefined) {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', await bcrypt.hash(password, 12), id);
      db.run('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', id);
    }
    audit(req, 'user.updated', 'user', id, JSON.stringify(Object.keys(req.body)));
    res.json({ ok: true });
  }));

module.exports = router;
