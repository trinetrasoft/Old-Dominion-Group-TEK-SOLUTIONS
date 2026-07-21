/* End-to-end smoke test against a running server (default http://localhost:8080).
 * Requires seeded demo data. Run: npm run smoke [BASE_URL] */
const BASE = process.argv[2] || 'http://localhost:8080';
const PW = 'OdgDemo!2026x';
let passed = 0, failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function login(email) {
  const { status, data } = await call('/auth/login', { method: 'POST', body: { email, password: PW } });
  if (status !== 200) throw new Error(`login failed for ${email}: ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  console.log(`Smoke test against ${BASE}\n`);

  const health = await call('/health');
  check('health endpoint', health.status === 200);

  console.log('\nAuth');
  const bad = await call('/auth/login', { method: 'POST', body: { email: 'admin@odg.example', password: 'wrong-password' } });
  check('wrong password rejected', bad.status === 401);
  const noAuth = await call('/opportunities');
  check('unauthenticated request rejected', noAuth.status === 401);

  const admin = await login('admin@odg.example');
  const est = await login('evan@odg.example');
  const mgmt = await login('maria@odg.example');
  const coord = await login('dee@odg.example');
  const acct = await login('grace@odg.example');
  const vend = await login('vendor@tidewatermech.example');
  check('all demo roles can log in', true);

  const refreshed = await call('/auth/refresh', { method: 'POST', body: { refreshToken: admin.refreshToken } });
  check('refresh token rotation works', refreshed.status === 200 && refreshed.data.accessToken);
  const reused = await call('/auth/refresh', { method: 'POST', body: { refreshToken: admin.refreshToken } });
  check('reused refresh token rejected', reused.status === 401);

  console.log('\nRBAC enforcement');
  check('estimator cannot read audit log', (await call('/audit', { token: est.accessToken })).status === 403);
  check('estimator cannot decide go/no-go', (await call('/opportunities/2/decision', { method: 'POST', token: est.accessToken, body: { decision: 'go' } })).status === 403);
  check('coordinator cannot create users', (await call('/users', { method: 'POST', token: coord.accessToken, body: { email: 'x@x.com', name: 'x', role: 'admin', password: 'aaaaaaaaaa' } })).status === 403);
  check('vendor cannot list vendors', (await call('/vendors', { token: vend.accessToken })).status === 403);
  check('vendor cannot read projects', (await call('/projects', { token: vend.accessToken })).status === 403);
  check('accounting CAN read audit log', (await call('/audit', { token: acct.accessToken })).status === 200);

  console.log('\nWorkflow: opportunity -> bid -> project');
  const opp = await call('/opportunities', { method: 'POST', token: coord.accessToken, body: { title: 'Smoke Test Job', client: 'Smoke GC', est_value: 100000 } });
  check('coordinator creates opportunity', opp.status === 201);
  const oid = opp.data.id;
  const earlyBid = await call('/bids', { method: 'POST', token: est.accessToken, body: { opportunity_id: oid, labor_cost: 10 } });
  check('bid blocked before Go decision', earlyBid.status === 409);
  check('prequalify transition', (await call(`/opportunities/${oid}`, { method: 'PATCH', token: coord.accessToken, body: { status: 'prequalification' } })).status === 200);
  check('management records Go', (await call(`/opportunities/${oid}/decision`, { method: 'POST', token: mgmt.accessToken, body: { decision: 'go' } })).status === 200);

  const bid = await call('/bids', { method: 'POST', token: est.accessToken, body: { opportunity_id: oid, labor_cost: 50000, material_cost: 30000, margin_pct: 20 } });
  check('estimator creates bid', bid.status === 201);
  const bidId = bid.data.id;
  check('invalid transition draft->submitted blocked', (await call(`/bids/${bidId}/status`, { method: 'POST', token: est.accessToken, body: { status: 'submitted' } })).status === 409);
  await call(`/bids/${bidId}/status`, { method: 'POST', token: est.accessToken, body: { status: 'in_review' } });
  check('estimator cannot award own bid', (await call(`/bids/${bidId}/award`, { method: 'POST', token: est.accessToken, body: { outcome: 'won' } })).status === 403);
  await call(`/bids/${bidId}/status`, { method: 'POST', token: est.accessToken, body: { status: 'submitted' } });
  const won = await call(`/bids/${bidId}/award`, { method: 'POST', token: mgmt.accessToken, body: { outcome: 'won' } });
  check('management awards bid, project created', won.status === 200 && won.data.project_id);

  const pid = won.data.project_id;
  check('execution blocked until CIP + turnover', (await call(`/projects/${pid}`, { method: 'PATCH', token: coord.accessToken, body: { status: 'execution' } })).status === 409);
  await call(`/projects/${pid}`, { method: 'PATCH', token: coord.accessToken, body: { cip_enrolled: true, turnover_reviewed: true } });
  check('execution allowed after gates', (await call(`/projects/${pid}`, { method: 'PATCH', token: coord.accessToken, body: { status: 'execution' } })).status === 200);

  console.log('\nSegregation of duties');
  const inv = await call(`/projects/${pid}/invoices`, { method: 'POST', token: coord.accessToken, body: { amount: 5000, description: 'smoke' } });
  check('coordinator raises invoice', inv.status === 201);
  check('coordinator cannot approve invoices', (await call(`/projects/invoices/${inv.data.id}/status`, { method: 'POST', token: coord.accessToken, body: { status: 'approved' } })).status === 403);
  check('accounting approves invoice', (await call(`/projects/invoices/${inv.data.id}/status`, { method: 'POST', token: acct.accessToken, body: { status: 'approved' } })).status === 200);

  console.log('\nVendor portal scoping');
  const sols = await call('/vendors/solicitations/all', { token: vend.accessToken });
  check('vendor sees scoped solicitation list', sols.status === 200 && Array.isArray(sols.data) && !('responses' in (sols.data[0] || {})));
  const open = sols.data.find(s => s.status === 'open' && !s.my_response_status);
  if (open) {
    const resp = await call(`/vendors/solicitations/${open.id}/respond`, { method: 'POST', token: vend.accessToken, body: { price: 92000, lead_time_days: 21 } });
    check('approved vendor submits quote', resp.status === 201);
    const dup = await call(`/vendors/solicitations/${open.id}/respond`, { method: 'POST', token: vend.accessToken, body: { price: 91000 } });
    check('duplicate quote rejected', dup.status === 409);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('Smoke test crashed:', e.message); process.exit(1); });
