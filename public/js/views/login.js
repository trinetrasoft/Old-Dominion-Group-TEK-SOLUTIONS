import { api, bindForm } from '../api.js';
import { setSession } from '../state.js';
import { icon } from '../icons.js';
import { toast } from '../ui/toast.js';

const DEMO_PASSWORD = 'OdgDemo!2026x';
const DEMO_ACCOUNTS = [
  { email: 'admin@odg.example', role: 'Admin' },
  { email: 'maria@odg.example', role: 'Management' },
  { email: 'dee@odg.example', role: 'Coordinator' },
  { email: 'evan@odg.example', role: 'Estimator' },
  { email: 'priya@odg.example', role: 'Procurement' },
  { email: 'jack@odg.example', role: 'Project Manager' },
  { email: 'grace@odg.example', role: 'Accounting' },
  { email: 'vendor@tidewatermech.example', role: 'Vendor' },
];

async function doLogin(email, password) {
  const data = await api('/auth/login', { method: 'POST', body: { email, password } });
  setSession(data);
  location.hash = '#/dashboard';
  window.render?.();
}

function showLoginError(message) {
  const el = document.getElementById('login-err');
  if (el) {
    el.textContent = message;
    el.hidden = false;
  }
  toast(message, true);
}

export function viewLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="login-wrap">
    <div class="login-split">
      <aside class="login-hero" aria-label="Brand">
        <div class="login-hero-inner">
          <img src="/assets/tek-solutions-logo.png" alt="TEK Solutions" class="login-logo">
          <p class="login-hero-tag">Enterprise operations for specialty construction</p>
          <ul class="login-hero-points">
            <li>RFQ intake &amp; go/no-go</li>
            <li>Bids, vendors &amp; solicitations</li>
            <li>Projects, billing &amp; closeout</li>
          </ul>
        </div>
      </aside>

      <section class="login-panel">
        <div class="login-panel-inner">
          <h1 class="login-title">Sign in</h1>
          <p class="sub">Access the ODG Operations Platform</p>
          <form id="login-form">
            <label class="f"><span>Email</span><input name="email" type="email" required autocomplete="username"></label>
            <div style="height:14px"></div>
            <label class="f"><span>Password</span><input name="password" type="password" required autocomplete="current-password"></label>
            <div style="height:20px"></div>
            <button class="btn primary" type="submit">${icon('chevron-right', 'icon icon-sm')} Sign in</button>
            <p class="error-msg" id="login-err" hidden role="alert"></p>
          </form>

          <div class="demo-creds" aria-label="Quick demo sign-in">
            <div class="demo-creds-head">
              <strong>Quick demo sign-in</strong>
              <span>One click — no password needed</span>
            </div>
            <ul class="demo-accounts">
              ${DEMO_ACCOUNTS.map(a => `
                <li>
                  <button type="button" class="demo-account" data-email="${a.email}">
                    <span class="demo-role">${a.role}</span>
                    <span class="demo-email">${a.email}</span>
                  </button>
                </li>`).join('')}
            </ul>
            <p class="demo-hint">Click an account to sign in instantly</p>
          </div>

          <p class="login-foot">Powered by TEK Solutions · Old Dominion Group</p>
        </div>
      </section>
    </div>
  </div>`;

  document.querySelectorAll('.demo-account').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = btn.dataset.email;
      const err = document.getElementById('login-err');
      if (err) err.hidden = true;
      btn.disabled = true;
      const prev = btn.innerHTML;
      btn.innerHTML = `<span class="demo-role">Signing in…</span><span class="demo-email">${email}</span>`;
      try {
        await doLogin(email, DEMO_PASSWORD);
      } catch (e) {
        showLoginError(e.message);
        btn.disabled = false;
        btn.innerHTML = prev;
      }
    });
  });

  bindForm('login-form', async body => {
    try {
      await doLogin(body.email, body.password);
    } catch (e) {
      showLoginError(e.message);
      throw e;
    }
  });
}
