import { api, bindForm } from '../api.js';
import { setSession } from '../state.js';
import { icon } from '../icons.js';

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
            <label class="f"><span>Email</span><input name="email" type="email" required autocomplete="username" value="admin@odg.example"></label>
            <div style="height:14px"></div>
            <label class="f"><span>Password</span><input name="password" type="password" required autocomplete="current-password" value="${DEMO_PASSWORD}"></label>
            <div style="height:20px"></div>
            <button class="btn primary" type="submit">${icon('chevron-right', 'icon icon-sm')} Sign in</button>
            <p class="error-msg" id="login-err" hidden role="alert"></p>
          </form>

          <div class="demo-creds" aria-label="Demo login credentials">
            <div class="demo-creds-head">
              <strong>Demo credentials</strong>
              <span>Password for all accounts</span>
            </div>
            <div class="demo-password">
              <code id="demo-password">${DEMO_PASSWORD}</code>
              <button type="button" class="btn sm ghost" id="copy-demo-password" title="Copy password">Copy</button>
            </div>
            <ul class="demo-accounts">
              ${DEMO_ACCOUNTS.map(a => `
                <li>
                  <button type="button" class="demo-account" data-email="${a.email}" data-password="${DEMO_PASSWORD}">
                    <span class="demo-role">${a.role}</span>
                    <span class="demo-email">${a.email}</span>
                  </button>
                </li>`).join('')}
            </ul>
            <p class="demo-hint">Click an account to fill the form</p>
          </div>

          <p class="login-foot">Powered by TEK Solutions · Old Dominion Group</p>
        </div>
      </section>
    </div>
  </div>`;

  const form = document.getElementById('login-form');
  const emailInput = form.querySelector('[name=email]');
  const passwordInput = form.querySelector('[name=password]');

  document.querySelectorAll('.demo-account').forEach(btn => {
    btn.addEventListener('click', () => {
      emailInput.value = btn.dataset.email;
      passwordInput.value = btn.dataset.password;
      emailInput.focus();
    });
  });

  document.getElementById('copy-demo-password')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(DEMO_PASSWORD);
      const b = document.getElementById('copy-demo-password');
      b.textContent = 'Copied';
      setTimeout(() => { b.textContent = 'Copy'; }, 1500);
    } catch { /* ignore */ }
  });

  bindForm('login-form', async body => {
    try {
      const data = await api('/auth/login', { method: 'POST', body });
      setSession(data);
      location.hash = '#/dashboard';
      window.render?.();
    } catch (e) {
      const el = document.getElementById('login-err');
      el.textContent = e.message;
      el.hidden = false;
      throw e;
    }
  });
}
