const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbFile = path.resolve(config.dbPath);
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  vendor_id INTEGER REFERENCES vendors(id),
  is_active INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stage 1: Opportunity Management & Lead Intake
CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  client TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'rfq',          -- rfq | rfp | bid_stream | referral
  description TEXT NOT NULL DEFAULT '',
  est_value REAL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'intake',        -- intake | prequalification | go | no_go
  decision_notes TEXT,
  assigned_estimator INTEGER REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stage 2: Bid Development & Pricing
CREATE TABLE IF NOT EXISTS bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER NOT NULL REFERENCES opportunities(id),
  scope_summary TEXT NOT NULL DEFAULT '',
  labor_cost REAL NOT NULL DEFAULT 0,
  material_cost REAL NOT NULL DEFAULT 0,
  sub_cost REAL NOT NULL DEFAULT 0,
  margin_pct REAL NOT NULL DEFAULT 15,
  total_price REAL NOT NULL DEFAULT 0,
  risk_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',         -- draft | in_review | submitted | won | lost
  submitted_at TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Vendor Portal: onboarding + risk/compliance pipeline
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  trade TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'invited',       -- invited | onboarding | compliance_review | approved | rejected | suspended
  insurance_ok INTEGER NOT NULL DEFAULT 0,
  legal_ok INTEGER NOT NULL DEFAULT 0,
  financial_ok INTEGER NOT NULL DEFAULT 0,
  score_quality REAL,                            -- vendor scorecard (deck: quality, on-time, pricing)
  score_delivery REAL,
  score_pricing REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Syndicated bid solicitation (push model, replaces email/EUC)
CREATE TABLE IF NOT EXISTS solicitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunity_id INTEGER REFERENCES opportunities(id),
  project_id INTEGER REFERENCES projects(id),
  title TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  trade TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'open',          -- open | closed | awarded
  awarded_response INTEGER,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS solicitation_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  solicitation_id INTEGER NOT NULL REFERENCES solicitations(id),
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  price REAL NOT NULL,
  lead_time_days INTEGER,
  exclusions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',     -- submitted | shortlisted | awarded | declined
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (solicitation_id, vendor_id)
);

-- Stages 3-5: Award & Initiation -> Execution -> Closeout
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bid_id INTEGER REFERENCES bids(id),
  name TEXT NOT NULL,
  client TEXT NOT NULL,
  contract_value REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiation',    -- initiation | execution | closeout | closed
  cip_enrolled INTEGER NOT NULL DEFAULT 0,      -- Controlled Insurance Program (deck 3.6)
  turnover_reviewed INTEGER NOT NULL DEFAULT 0, -- turnover binder (deck 3.4/3.5)
  pm_id INTEGER REFERENCES users(id),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS change_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | approved | rejected
  decided_by INTEGER REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  amount REAL NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',         -- draft | submitted | approved | paid
  due_date TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Immutable audit trail of every mutation (deck: fraud detection, compliance)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bids_opp ON bids(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_resp_sol ON solicitation_responses(solicitation_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);
`);

// Tiny helpers so route code stays readable.
module.exports = {
  raw: db,
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
  tx(fn) {
    db.exec('BEGIN');
    try { const r = fn(); db.exec('COMMIT'); return r; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  },
};
