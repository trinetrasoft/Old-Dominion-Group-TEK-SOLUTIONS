# ODG Operations Platform

A production-ready web application implementing Old Dominion Group's end-to-end specialty construction workflow — from RFQ intake through bid development, vendor procurement, project execution, and financial closeout — with server-enforced role-based access control, workflow state machines, segregation of duties, and a full audit trail.

Built from the "Proposal for Old Dominion Group" business case: the five-stage business process flow, the Vendor Portal (onboarding + risk/compliance/legal pipeline, syndicated bid solicitation, scorecards), and the operational controls the deck identifies (CIP enrollment gates, change-order discipline, prompt billing, fraud-resistant approvals).

## Stack

- **Runtime:** Node.js ≥ 22.5 (uses the built-in `node:sqlite` — zero native dependencies)
- **Backend:** Express 5, JWT auth (short-lived access + rotating refresh tokens), bcrypt, Zod validation, Helmet, rate limiting
- **Database:** SQLite (WAL mode) — swap `server/db.js` for Postgres when you outgrow it
- **Frontend:** Modular vanilla SPA (Inter, Chart.js, glass UI) served by the same process — no build step

## Quick start

**Requirements:** Node.js ≥ 22.5

```bash
git clone https://github.com/trinetrasoft/Old-Dominion-Group-TEK-SOLUTIONS.git
cd Old-Dominion-Group-TEK-SOLUTIONS

cp .env.example .env   # Windows: copy .env.example .env
npm install
npm run seed           # creates demo users + sample data, prints the demo password
npm start              # http://localhost:8080
```

Optional checks:

```bash
npm run smoke          # end-to-end checks: auth, RBAC, workflow gates, SoD
```

Open **http://localhost:8080** — use **Quick demo sign-in** on the login page (one click per role), or sign in manually with credentials from `npm run seed`.

Demo accounts (all share the password printed by the seed):

| Email | Role |
|---|---|
| admin@odg.example | admin |
| maria@odg.example | management |
| dee@odg.example | coordinator (Billing Project Coordinator) |
| evan@odg.example | estimator |
| priya@odg.example | procurement |
| jack@odg.example | project_manager |
| grace@odg.example | accounting |
| vendor@tidewatermech.example | vendor (external portal) |

## RBAC

Roles map 1:1 to the org roles in ODG's process flow. Permissions are enforced **server-side per route** (`server/rbac.js` is the single source of truth); the UI merely hides what a role can't do.

| Capability | admin | mgmt | coord | estim | procure | PM | acct | vendor |
|---|---|---|---|---|---|---|---|---|
| Opportunity intake / update | ✓ | | ✓ | | | | | |
| Go / No-Go decision | ✓ | ✓ | | | | | | |
| Create / edit / submit bids | ✓ | | | ✓ | | | | |
| Award bids (creates project) | ✓ | ✓ | | | | | | |
| Vendor onboarding & compliance checks | ✓ | | | | ✓ | | | |
| Final vendor approval | ✓ | ✓ | | | | | | |
| Create solicitations | ✓ | | | | ✓ | ✓ | | |
| Respond to solicitations | | | | | | | | ✓ (own co.) |
| Award solicitations | ✓ | ✓ | | | ✓ | | | |
| Project updates / initiation gates | ✓ | | ✓ | | | ✓ | | |
| Raise change orders | ✓ | | | | | ✓ | | |
| Approve change orders | ✓ | ✓ | | | | | | |
| Raise invoices | ✓ | | ✓ | | | ✓ | | |
| Approve / pay invoices | ✓ | | | | | | ✓ | |
| Close projects | ✓ | ✓ | | | | | | |
| User management | ✓ | | | | | | | |
| Audit log | ✓ | ✓ | | | | | ✓ | |

**Controls beyond the matrix** (from the deck's risk findings):

- **Workflow state machines** — invalid transitions are rejected (e.g., bids only against Go-decided opportunities; draft → in_review → submitted → won/lost).
- **Initiation gates** — a project cannot enter execution until CIP enrollment and turnover review are recorded (deck steps 3.4–3.6).
- **Segregation of duties** — nobody approves their own change order or invoice, even with the approve permission.
- **Compliance gate** — vendors cannot be approved until insurance, legal, and financial checks all pass.
- **Vendor scoping** — vendor accounts see only open solicitations and their own responses; competitor pricing is never exposed.
- **Closeout discipline** — projects cannot close with pending change orders or unapproved invoices (deck 5.8).
- **Audit trail** — every login (including failures), mutation, and denied access attempt is written to an append-only log with actor, IP, and detail.
- **Account protection** — bcrypt(12) hashing, lockout after 5 failed logins, refresh-token rotation with reuse detection, session revocation on password change or deactivation.

## API overview

All routes under `/api`, JSON in/out, `Authorization: Bearer <accessToken>`.

```
POST /auth/login | /auth/refresh | /auth/logout | /auth/change-password
GET  /auth/me
GET  /dashboard                         role-aware metrics + stage funnel
GET|POST /opportunities                 PATCH /opportunities/:id
POST /opportunities/:id/decision        {decision: go|no_go}
GET|POST /bids                          PATCH /bids/:id
POST /bids/:id/status                   {status: in_review|draft|submitted}
POST /bids/:id/award                    {outcome: won|lost} → creates project on win
GET|POST /vendors                       PATCH /vendors/:id
POST /vendors/:id/decision              {decision: approved|rejected}
GET  /vendors/solicitations/all         scoped for vendor accounts
POST /vendors/solicitations
POST /vendors/solicitations/:id/respond
POST /vendors/solicitations/:id/award
GET|POST /projects                      GET /projects/:id · PATCH /projects/:id
POST /projects/:id/close
POST /projects/:id/change-orders        POST /projects/change-orders/:id/decision
POST /projects/:id/invoices             POST /projects/invoices/:id/status
GET|POST /users                         PATCH /users/:id
GET  /audit
```

## Configuration

Copy `.env.example` to `.env`. In production the server **refuses to start** without strong `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` values:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Docker

```bash
cp .env.example .env       # set both JWT secrets
SEED_ON_BOOT=1 docker compose up --build   # seed on first boot only
```

Data persists in the `odg-data` volume. Run behind a TLS-terminating reverse proxy (Caddy/nginx/ALB); `trust proxy` is already set.

## Production checklist

- [x] Secrets from env, hard-fail if weak in production
- [x] Helmet CSP (no inline script), HSTS, rate limiting (global + login-specific)
- [x] Input validation on every write (Zod), parameterized SQL everywhere
- [x] Non-root Docker user, healthcheck endpoint (`/api/health`)
- [x] Structured audit logging, immutable via API
- [ ] Point `DATABASE_PATH` at durable storage and schedule SQLite backups (`.backup`)
- [ ] Add your IdP (the auth layer is isolated in `server/routes/auth.js` — swap for OIDC/SAML if ODG uses Entra ID)
- [ ] Wire log shipping / metrics to your observability stack
