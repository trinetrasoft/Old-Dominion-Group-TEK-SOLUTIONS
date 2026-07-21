const jwt = require('jsonwebtoken');
const { ZodError } = require('zod');
const config = require('../config');
const db = require('../db');
const { hasPermission } = require('../rbac');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Verify Bearer access token and attach req.user. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret);
    const user = db.get('SELECT id, email, name, role, vendor_id, is_active FROM users WHERE id = ?', payload.sub);
    if (!user || !user.is_active) return next(new HttpError(401, 'Account is inactive'));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

/** Require a specific RBAC permission. Usage: requirePermission(P.BID_CREATE) */
function requirePermission(perm) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!hasPermission(req.user.role, perm)) {
      audit(req, 'access.denied', 'permission', null, perm);
      return next(new HttpError(403, `Missing permission: ${perm}`));
    }
    next();
  };
}

/** Validate req.body against a zod schema; replaces body with parsed data. */
function validate(schema) {
  return (req, res, next) => {
    try { req.body = schema.parse(req.body ?? {}); next(); }
    catch (e) { next(e); }
  };
}

/** Write an immutable audit record. Never throws. */
function audit(req, action, entity, entityId = null, detail = null) {
  try {
    db.run(
      'INSERT INTO audit_log (user_id, user_email, action, entity, entity_id, detail, ip) VALUES (?,?,?,?,?,?,?)',
      req.user?.id ?? null, req.user?.email ?? null, action, entity, entityId,
      detail ? String(detail).slice(0, 500) : null, req.ip || null
    );
  } catch (e) { console.error('audit write failed:', e.message); }
}

/** Wrap async handlers so rejections reach the error handler. */
const asyncH = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res, next) { next(new HttpError(404, 'Not found')); }

function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.issues.map(i => `${i.path.join('.')}: ${i.message}`) });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && config.isProd ? 'Internal server error' : err.message });
}

module.exports = { HttpError, authenticate, requirePermission, validate, audit, asyncH, notFound, errorHandler };
