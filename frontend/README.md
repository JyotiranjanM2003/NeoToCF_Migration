# Neo → CF Migration App — Frontend (Phase 1 + Phase 2)

React (Vite) app implementing the full v1 flow end to end:

**Phase 1**
- Sign up / Log in (JWT access token in memory, refresh via httpOnly cookie,
  silent session restore on page load)
- Dashboard with separate **Connect Source (Neo)** and **Connect Target
  (Cloud Foundry)** cards, with a visual connector that lights up once both
  report `CONNECTED`

**Phase 2**
- **Packages** — live list from the source tenant
- **Package Detail** — artifacts tagged `iFlow` / `Value Mapping`, with
  package-level Validate / Download (.zip) / Migrate actions
- **iFlow Detail** — Name / Version / Status / Package + configuration
  parameter table, with Validate / Download / Migrate actions (matches your
  sketch layout exactly)
- **Migration Report** — polls live status until the run finishes, then
  shows the full step-by-step log
- **Transform Rules** — manage find/replace rules (e.g. source host →
  target host) applied during migration's config transform step

Sidebar nav has Data Stores / Variables / Security Materials present but
disabled — ready to enable as each later phase is built.

## Setup

```bash
npm install
cp .env.example .env   # VITE_API_BASE_URL defaults to /api (proxied to :5000 in dev)
npm run dev
```

The Vite dev server proxies `/api/*` to `http://localhost:5000` (see
`vite.config.js`), so run the backend from the companion zip alongside this.

## Structure

```
src/
  context/AuthContext.jsx        # session state, login/signup/logout, silent refresh
  services/api/
    client.js                    # axios instance, attaches JWT, retries once on 401 via /auth/refresh
    auth.api.js
    tenant.api.js
  components/
    layout/AppShell.jsx          # sidebar + header shell for authenticated pages
    layout/ProtectedRoute.jsx
    tenant/TenantConnectForm.jsx # field-driven form, shared by Neo + CF connect pages
    tenant/StatusBadge.jsx
  pages/
    SignUp.jsx
    Login.jsx
    Dashboard.jsx                # source/target status cards + connector
    ConnectSourceTenant.jsx
    ConnectTargetTenant.jsx
```

## Design notes

Token system: cool-neutral background (#F5F6F8), ink text, teal accent
(#0F6E66) for connected/primary actions, amber/red reserved for
warning/error states. IBM Plex Sans for UI text, IBM Plex Mono for tenant
hosts, IDs, and status codes — those are technical values the user will
copy/verify, so they get a typeface that reads as data rather than prose.

The signature element is the dashed connector line between the Source and
Target tenant cards on the dashboard: it turns solid teal and pulses once
both tenants are `CONNECTED`, echoing the Neo → App → CF diagram from the
architecture doc. `prefers-reduced-motion` disables the pulse.

## Next phases (not built yet)

Data Stores, Variables, Custom Tags, Number Ranges, Access Policies,
Security Artifacts, Value Mapping Values — each follows the same
page + service-file pattern already established here.
