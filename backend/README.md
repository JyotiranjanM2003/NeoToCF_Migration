# Neo → CF Migration App — Backend (Phase 1 + Phase 2)

Implements the full v1 architecture end to end:

**Phase 1**
- User sign up / login / refresh / logout with JWT (access token in
  response body, refresh token in an httpOnly cookie)
- Connect Source Tenant (Neo) / Connect Target Tenant (CF) — saves
  credentials, tests OAuth + XSRF token retrieval, persists `ConnectionStatus`

**Phase 2**
- **Packages** — live list from the source tenant, per-package artifact
  listing tagged `IFLOW` / `VALUE_MAPPING`, package-level zip download
- **iFlow detail** — Name/Version/Status/Package + configuration parameter
  table, single-artifact zip download
- **Validation Engine** — the 6-check readiness gate (`READY` / `BLOCKED`)
- **Migration Engine** — the 9-step pipeline (package or single-artifact
  scope), runs asynchronously, writes to `MIGRATION` / `MIGRATION_ARTIFACT`
  / `MIGRATION_CONFIGURATION` / `MIGRATION_LOG` as it goes
- **Migration Report** — built entirely from those 4 tables
- **Transform rules** — simple find/replace rules (e.g. source host → target
  host) applied during the pipeline's `TRANSFORM_CONFIG` step

Not yet built (later phases, same pattern): Data Stores, Variables, Custom
Tags, Number Ranges, Access Policies, Security Artifacts, Value Mapping
Values.

## Setup

```bash
npm install
cp .env.example .env
# fill in HANA_*, JWT_*_SECRET, and generate TENANT_SECRET_ENC_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the schema against your HANA schema once:

```bash
hdbsql -n <host>:<port> -u <user> -p <password> -I sql/schema.sql
```

Start the server:

```bash
npm run dev   # nodemon
# or
npm start
```

## Endpoints implemented in this phase

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Create account, returns access token + sets refresh cookie |
| POST | `/api/auth/login` | — | Login, returns access token + sets refresh cookie |
| POST | `/api/auth/refresh` | refresh cookie | Issue new access token |
| POST | `/api/auth/logout` | — | Clears refresh cookie |
| GET | `/api/auth/me` | Bearer token | Current user |
| POST | `/api/tenants/source` | Bearer token | Save + test Neo connection |
| GET | `/api/tenants/source` | Bearer token | Current Neo connection status |
| POST | `/api/tenants/source/test` | Bearer token | Re-test saved Neo connection |
| POST | `/api/tenants/target` | Bearer token | Save + test CF connection |
| GET | `/api/tenants/target` | Bearer token | Current CF connection status |
| POST | `/api/tenants/target/test` | Bearer token | Re-test saved CF connection |
| GET | `/api/packages` | Bearer token | List packages from the connected source tenant |
| GET | `/api/packages/:packageId/artifacts` | Bearer token | List artifacts in a package, tagged by type |
| GET | `/api/packages/:packageId/download` | Bearer token | Download whole package as zip |
| GET | `/api/iflows/:id?packageId=...` | Bearer token | iFlow detail + configuration |
| GET | `/api/iflows/:id/configuration` | Bearer token | Configuration parameters only |
| GET | `/api/iflows/:id/download` | Bearer token | Download single artifact as zip |
| POST | `/api/validation/run` | Bearer token | Run the 6-check validation engine |
| POST | `/api/migration/start` | Bearer token | Start a migration (package or single artifact) |
| GET | `/api/migration` | Bearer token | List past migrations for the user |
| GET | `/api/migration/:id/status` | Bearer token | Poll migration + per-artifact status |
| GET | `/api/migration/:id/report` | Bearer token | Full report (artifacts + config + logs) |
| GET/POST/DELETE | `/api/transform-rules` | Bearer token | Manage find/replace config transform rules |

### Example: connect source tenant

```http
POST /api/tenants/source
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "tenantName": "Neo Prod",
  "host": "abc-tmn.hci.eu1.hana.ondemand.com",
  "tokenHost": "abc.authentication.eu1.hana.ondemand.com",
  "oauthClientId": "sb-clone-...",
  "oauthClientSecret": "xxxxx"
}
```

Response persists `ConnectionStatus` as `CONNECTED` or `ERROR` and reflects
it back in `GET /api/tenants/source` for the dashboard's tenant status card.

## Notes

- One source tenant + one target tenant per user for v1 (`upsert` overwrites
  the previous one) — matches the "connect source / connect target" dashboard
  sections in the spec. Multi-tenant-per-user can be added later by dropping
  the upsert-by-user-id constraint.
- `TRANSFORM_RULE` table is included in the schema now (find/replace rules
  for the config transform step, e.g. source host → target host) even though
  the migration engine that consumes it is a later phase.
- Tenant OAuth secrets are AES-256-GCM encrypted before being stored; the
  raw secret is only ever held in memory for the duration of a token
  request and is never returned to the frontend.
