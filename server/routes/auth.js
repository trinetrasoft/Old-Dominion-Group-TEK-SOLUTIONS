const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../db');
const { permissionsFor } = require('../rbac');
const { HttpError, authenticate, validate, audit, asyncH } = require('../middleware/core');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20,
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: 'Too many login attempts, try again later' },
});

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

function issueTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessTtl }
  );
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + config.jwt.refreshTtlDays * 86400_000).toISOString();
  db.run('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?,?,?)',
    user.id, sha256(refreshToken), expires);
  return { accessToken, refreshToken };
}

function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, vendor_id: u.vendor_id, permissions: permissionsFor(u.role) };
}

router.post('/login', loginLimiter,
  validate(z.object({ email: z.string().email(), password: z.string().min(1) })),
  asyncH(async (req, res) => {
    const { email, password } = req.body;
    const user = db.get('SELECT * FROM users WHERE email = ?', email);

    if (user?.locked_until && user.locked_until > new Date().toISOString()) {
      throw new HttpError(423, 'Account temporarily locked due to failed logins');
    }
    const ok = user && await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      if (user) {
        const fails = user.failed_logins + 1;
        const lock = fails >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
        db.run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', fails, lock, user.id);
      }
      db.run('INSERT INTO audit_log (user_email, action, entity, ip) VALUES (?,?,?,?)',
        email, 'auth.login_failed', 'user', req.ip || null);
      throw new HttpError(401, 'Invalid email or password');
    }
    if (!user.is_active) throw new HttpError(403, 'Account is deactivated');

    db.run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', user.id);
    req.user = user;
    audit(req, 'auth.login', 'user', user.id);
    res.json({ user: publicUser(user), ...issueTokens(user) });
  }));

router.post('/refresh',
  validate(z.object({ refreshToken: z.string().min(20) })),
  asyncH(async (req, res) => {
    const hash = sha256(req.body.refreshToken);
    const row = db.get('SELECT * FROM refresh_tokens WHERE token_hash = ?', hash);
    if (!row || row.revoked || row.expires_at < new Date().toISOString()) {
      throw new HttpError(401, 'Invalid refresh token');
    }
    const user = db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', row.user_id);
    if (!user) throw new HttpError(401, 'Account is inactive');
    // Rotation: revoke the used token, issue a new pair.
    db.run('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?', row.id);
    res.json({ user: publicUser(user), ...issueTokens(user) });
  }));

router.post('/logout', authenticate,
  validate(z.object({ refreshToken: z.string().optional() })),
  asyncH(async (req, res) => {
    if (req.body.refreshToken) {
      db.run('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?', sha256(req.body.refreshToken));
    }
    audit(req, 'auth.logout', 'user', req.user.id);
    res.json({ ok: true });
  }));

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/change-password', authenticate,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(10).max(128) })),
  asyncH(async (req, res) => {
    const user = db.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!(await bcrypt.compare(req.body.currentPassword, user.password_hash))) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', await bcrypt.hash(req.body.newPassword, 12), user.id);
    db.run('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', user.id); // kill other sessions
    audit(req, 'auth.password_changed', 'user', user.id);
    res.json({ ok: true });
  }));

module.exports = router;
