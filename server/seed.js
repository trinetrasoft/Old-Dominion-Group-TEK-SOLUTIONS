/* Seeds demo users (one per role) and sample workflow data.
 * Idempotent: skips if users already exist. Run: npm run seed */
const bcrypt = require('bcryptjs');
const db = require('./db');

const DEMO_PASSWORD = 'OdgDemo!2026x';

const USERS = [
  ['admin@odg.example', 'Ava Admin', 'admin'],
  ['maria@odg.example', 'Maria Whitfield', 'management'],
  ['dee@odg.example', 'Dee Carver', 'coordinator'],
  ['evan@odg.example', 'Evan Ruiz', 'estimator'],
  ['priya@odg.example', 'Priya Nair', 'procurement'],
  ['jack@odg.example', 'Jack Malone', 'project_manager'],
  ['grace@odg.example', 'Grace Osei', 'accounting'],
];

function seed() {
  if (db.get('SELECT COUNT(*) AS n FROM users').n > 0) {
    console.log('Seed skipped: users already exist.');
    return;
  }
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 12);
  const ids = {};
  for (const [email, name, role] of USERS) {
    const r = db.run('INSERT INTO users (email, name, role, password_hash) VALUES (?,?,?,?)', email, name, role, hash);
    ids[role] = Number(r.lastInsertRowid);
  }

  // Vendors across the pipeline
  const v1 = Number(db.run("INSERT INTO vendors (company, contact_name, contact_email, trade, status, insurance_ok, legal_ok, financial_ok, score_quality, score_delivery, score_pricing, created_by) VALUES ('Tidewater Mechanical LLC','R. Boone','bids@tidewatermech.example','HVAC','approved',1,1,1,4.5,4.2,3.9,?)", ids.procurement).lastInsertRowid);
  db.run("INSERT INTO vendors (company, contact_name, contact_email, trade, status, insurance_ok, legal_ok, created_by) VALUES ('Blue Ridge Insulation Co','T. Marsh','office@brinsulation.example','Insulation','compliance_review',1,1,?)", ids.procurement);
  db.run("INSERT INTO vendors (company, contact_name, contact_email, trade, status, created_by) VALUES ('Chesapeake Fireproofing','L. Danvers','info@chesfp.example','Fireproofing','invited',?)", ids.procurement);

  // Vendor portal login for the approved vendor
  db.run('INSERT INTO users (email, name, role, password_hash, vendor_id) VALUES (?,?,?,?,?)',
    'vendor@tidewatermech.example', 'Tidewater Portal User', 'vendor', hash, v1);

  // Opportunities across stage 1
  const o1 = Number(db.run("INSERT INTO opportunities (title, client, source, description, est_value, due_date, status, assigned_estimator, created_by) VALUES ('Norfolk Naval Yard – Pipe Insulation Package','Hensel Phelps','rfq','Mechanical insulation for buildings 4 & 7, ~42k LF piping.',1850000,date('now','+21 days'),'go',?,?)", ids.estimator, ids.coordinator).lastInsertRowid);
  db.run("INSERT INTO opportunities (title, client, source, description, est_value, due_date, status, created_by) VALUES ('Richmond Data Center – Firestopping','DPR Construction','rfp','Firestopping scope, phased delivery.',640000,date('now','+14 days'),'prequalification',?)", ids.coordinator);
  db.run("INSERT INTO opportunities (title, client, source, description, est_value, created_by) VALUES ('VCU Lab Renovation – HVAC Insulation','Whiting-Turner','bid_stream','Lab renovation, night-shift constraints.',290000,?)", ids.coordinator);

  // A bid in review on the 'go' opportunity
  db.run("INSERT INTO bids (opportunity_id, scope_summary, labor_cost, material_cost, sub_cost, margin_pct, total_price, risk_notes, status, created_by) VALUES (?,?,?,?,?,?,?,?,'in_review',?)",
    o1, 'Full mechanical insulation per spec 23 07 00; excludes removable blankets.', 720000, 480000, 210000, 18, (720000+480000+210000)*1.18, 'Access constraints on B7 roof; escalation clause needed on jacketing.', ids.estimator);

  // A live project in execution with a pending change order and a submitted invoice
  const p1 = Number(db.run("INSERT INTO projects (name, client, contract_value, status, cip_enrolled, turnover_reviewed, pm_id, start_date) VALUES ('Hampton Roads Hospital Tower','Skanska',2400000,'execution',1,1,?,date('now','-60 days'))", ids.project_manager).lastInsertRowid);
  db.run("INSERT INTO change_orders (project_id, description, amount, created_by) VALUES (?,?,?,?)", p1, 'Added duct wrap for level 3 mechanical room per RFI-114', 46500, ids.project_manager);
  db.run("INSERT INTO invoices (project_id, amount, description, status, due_date, created_by) VALUES (?,?,?,'submitted',date('now','+30 days'),?)", p1, 185000, 'Progress billing #4 – 62% complete', ids.project_manager);

  // Open solicitation the vendor can respond to
  db.run("INSERT INTO solicitations (opportunity_id, title, scope, trade, due_date, created_by) VALUES (?,?,?,?,date('now','+10 days'),?)",
    o1, 'Sub-bid: Jacketing & Banding – Norfolk Naval Yard', 'Aluminum jacketing supply & install, ~42k LF.', 'Insulation', ids.procurement);

  console.log('Seeded demo data.');
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
  console.log('Accounts: ' + USERS.map(u => u[0]).join(', ') + ', vendor@tidewatermech.example');
}

seed();
