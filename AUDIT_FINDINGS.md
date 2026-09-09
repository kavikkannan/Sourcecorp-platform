# AUDIT FINDINGS — SourceCorp Platform v1.0.0
Audit date: 2026-08-05
Auditor: Claude Code (senior app-sec audit, read-only)

---

## System Map (Phase 0)

**Architecture**: Monorepo with two apps + reverse proxy:

- `backend/` — Node.js + Express 5 + TypeScript API
  - PostgreSQL 16 (`pg` driver, `backend/src/db/pool.ts`, schema in `backend/src/db/schema.sql`)
  - Redis 7 (`ioredis`, `backend/src/db/redis.ts`) — cache + BullMQ queue (`backend/src/services/queue.service.ts`, worker `backend/src/workers/export.worker.ts`)
  - JWT auth (`jsonwebtoken`, `backend/src/utils/jwt.ts`), bcryptjs password hashing (`backend/src/utils/password.ts`)
  - multer file uploads; exceljs/pdfkit/archiver for export generation
  - zod validators (`backend/src/validators/*`), helmet, cors, cookie-parser, winston logging
  - Entry: `backend/src/index.ts` → `app.ts`; routes: auth, admin, crm, finance, notes, tasks, template, users
  - Controllers: auth, users, roles, permissions, hierarchy, teams, announcements, audit, crm, finance, note, task, template, recognitions
- `frontend/` — Next.js 15 (App Router) + React 18 + Tailwind; axios API client; no third-party analytics in package.json
- `nginx/conf.d/default.conf` — reverse proxy, port 80 only (no TLS), security headers set, WebSocket proxying for `/socket.io`
- `docker-compose.txt` — Postgres, Redis, backend, frontend (note: stored as `.txt`, **contains default/placeholder secrets**)

**Stack**: TypeScript everywhere; PostgreSQL + Redis + BullMQ; no IaC (no Terraform/Pulumi/CDK); no CI/CD config found (`.github/workflows` absent); no cloud-provider SDKs.

**Tenancy model**: appears to be a **single-tenant internal platform** (users/roles/teams/hierarchy, CRM, finance, tasks, notes) — no obvious `tenant_id`/`org_id` column seen so far. Confirm in Phase 3. Multi-customer SaaS claims must be re-examined: this may be intended to be deployed per-customer.

**Notable recon observations (to verify in later phases)**:
1. `docker-compose.txt` has default fallback secrets: `DB_PASSWORD:-changeme_secure_password`, `JWT_SECRET:-change_this_in_production_jwt_secret`, `JWT_REFRESH_SECRET:-change_this_in_production_refresh_secret`.
2. nginx listens on port 80 only — no TLS/HSTS at proxy layer.
3. nginx has a "secret admin login" route `/logkavi` — security through obscurity, and the obscurity is now in the repo.
4. `.gitignore` covers `.env*` — good; no `.env` files found in repo at HEAD.
5. No ToS/Privacy Policy/Cookie Policy/LICENSE file spotted at top level yet.
6. `README.md` claims "JWT access tokens (15min expiry)" but `docker-compose.txt` sets `JWT_EXPIRES_IN: 24h` — mismatch to verify.

---

## Phase 1 — Data Inventory

### Collection points (all endpoints under `backend/src/routes/`, validators in `backend/src/validators/`)

| Endpoint | Fields captured | Classification |
|---|---|---|
| POST /api/auth/login (auth.routes.ts:9) | email, password + req.ip, user-agent to audit log (auth.controller.ts:56-63) | PII (email, IP, UA); Auth/secret (password) |
| POST /api/auth/refresh (auth.routes.ts:10) | refreshToken (body or cookie) | Auth/secret |
| POST/PATCH /api/admin/users (admin.routes.ts:41-66) | email, password, firstName, lastName, isActive | PII; Auth/secret |
| DELETE /api/admin/users/:id (admin.routes.ts:68-73) | user id | — |
| Roles/permissions/teams/hierarchy CRUD (admin.routes.ts:92-325) | names, descriptions, UUIDs | Internal config |
| POST /api/crm/cases (crm.routes.ts:27-33) | customer_name, customer_email, customer_phone, loan_type, loan_amount, source_type + up to 10 document files | **PII + Sensitive (loan data, KYC docs)** |
| POST /api/crm/cases/:id/status | new_status, remarks (free-text credit decisions) | Sensitive free text |
| POST /api/crm/cases/:id/documents, /notes, /schedule | file uploads, free-text notes | **Sensitive (documents may be IDs/bank statements)** |
| POST /api/crm/cases/:id/customer-detail-sheet (crm.routes.ts:208-213) | Excel parsed server-side into ~28 fields | **Highly sensitive — see below** |
| POST /api/crm/cases/:id/customer-detail-change-request (crm.controller.ts:869-900) | requested_changes = arbitrary JSON, NOT zod-validated | Sensitive |
| POST /api/crm/cases/export (crm.routes.ts:276-294) | caseIds[] producing ZIP of full case data | Bulk PII egress |
| POST /api/finance/eligibility/calculate | monthly_income, requested_amount, etc. | Sensitive (income/loan) |
| POST /api/finance/obligation, /cam | items[] arbitrary JSON; cam_data = z.record(z.any()) | Sensitive (EMIs, net income, full credit appraisal) |
| GET /api/finance/export/* | csv/xlsx/pdf of the above | Data egress |
| POST /api/notes, /api/tasks | free-text content/comments, linkedCaseId | Free text — may contain PII |
| Announcements / Recognitions (admin.routes.ts:231-364) | title/content + image; employee_name, employee_email, photo | PII (employee data + photo) |

**Customer detail sheet fields** (parsed at `backend/src/services/crm.service.ts:1214-1244`): name, DOB, **aadhar_number**, **pan_number**, father/mother names, marital status, current+permanent addresses, mobile, personal/official emails, office name/address, designation, salary (gross/net), education, **bank_name, bank_ifsc, bank_account_number**, UAN (PF). Plus unmapped raw_* key/value pairs (crm.service.ts:1277-1283). **Classification: PII + Sensitive/regulated (Indian government IDs, bank account, salary).**

### File uploads (multer, memoryStorage, 10MB limit)
- CRM: `crm.routes.ts:12-17` — case documents (x10), single doc, notes, schedule, detail sheet. **No fileFilter (any MIME) except detail-sheet extension check in controller (crm.controller.ts:776-778).**
- Admin: `admin.routes.ts:20-33` — announcement/recognition images, image/* filter present.

### Cookies/sessions
- cookie-parser at app.ts:23. Login sets httpOnly cookies accessToken + refreshToken, sameSite strict, `secure` only when NODE_ENV=production (auth.controller.ts:65-90). Auth middleware accepts cookie OR Bearer header (auth.middleware.ts:13-18).
- Frontend additionally stores user profile object + **CAM/obligation draft form data (customer financial data) in localStorage** (frontend/src/lib/auth.ts:82; financial-tools/cam/page.tsx:162; obligation/page.tsx:187).

### Third-party trackers
- **None.** Repo-wide search for segment/mixpanel/amplitude/posthog/GA/gtag/sentry/logrocket/hotjar/intercom/fullstory: zero real matches. No external data processors in code.

---

## Phase 2 — Storage Mapping

### Database (`backend/src/db/schema.sql` + migrations)
**No column-level encryption anywhere. Only `password_hash` is hashed (bcrypt $2a$10$, utils/password.ts). Everything else is plaintext, much of it JSONB.**

Key tables:
- `auth_schema.users` (schema.sql:17-26): email, password_hash (bcrypt), first/last name — names+email plaintext.
- `crm_schema.cases` (152-164): customer_name/email/phone, loan_type, loan_amount — **plaintext**.
- `crm_schema.customer_detail_sheets` (220-227): detail_data JSONB — **Aadhaar, PAN, bank account no., IFSC, UAN, salary, DOB, addresses — plaintext JSONB**.
- `crm_schema.customer_detail_change_requests`: requested_changes JSONB — plaintext.
- `crm_schema.case_notes`, `case_status_history.remarks`, `case_notifications` — free text (committed dumps show real bank credit decisions AND **customer document passwords typed into notes**, e.g. "CIBIL PASSWORD: [REDACTED]").
- `finance_schema.eligibility_calculations` (income, amounts), `cam_entries.cam_data JSONB` (versioned, all versions retained), `obligation_sheets/items` — **plaintext financials**.
- `audit_schema.audit_logs` (schema.sql:102-112): details JSONB + ip_address + user_agent on every mutation.
- `audit_schema.error_logs` (115-128; migrate-add-error-logs-table.ts:9-24): **request_body JSONB + request_query JSONB stored on every unhandled error — plaintext passwords and full customer PII land here** (error.middleware.ts:19-35). No redaction.

### Redis (`backend/src/db/redis.ts`)
- No TLS, no auth. Only key pattern: refresh_token:{userId} storing full JWT refresh token **plaintext**, 7-day TTL (auth.controller.ts:49-53). BullMQ shares the instance.

### BullMQ (queue.service.ts, export.worker.ts)
- Job payload = IDs only (userId, role, teams, caseIds) — but addExportJob overrides pruning to removeOnComplete:false / removeOnFail:false (queue.service.ts:33-37) — **jobs retained in Redis indefinitely**.

### Files
- Uploads land in uploads/documents/{timestamp}-{originalname} (crm.controller.ts:45-53, 338-347, 452-459, 609-616) — **flat directory, not per-customer scoped; originalname unsanitized (see Phase 3 traversal finding)**.
- Export ZIPs in uploads/exports/cases_export_*.zip (export.service.ts:964-968) containing full case JSON + all documents. **No cleanup job exists anywhere** — archives accumulate forever.
- Serving: GET /api/crm/documents/:documentId (auth + case-access check, crm.controller.ts:400-437); GET /api/crm/cases/export/download/:jobId — **permission-gated but NO job-ownership check: any user with crm.case.export can download anyone's export** (crm.controller.ts:1114-1140); GET /api/announcements/:id/image and /api/recognitions/:id/image are **fully unauthenticated** (app.ts:60-63) — employee photos served publicly.

### Logs
- Winston console-only (logger.ts:11-22). No Authorization-header logging found. BUT:
  - Audit service stores full note text, remarks, loan amounts, user emails/names in details (crm.service.ts:63,500,541,598; users.controller.ts:28,276; crm.controller.ts:1035). Passwords excluded from user-update audits only.
  - Error middleware persists **entire req.body** (passwords on auth routes) + stack to error_logs (error.middleware.ts:19-35).
- NOTE: committed DB dumps show users routinely type **customer document passwords (CIBIL / bank-statement / Aadhaar PDF passwords) into case notes**, and those notes are duplicated into audit_logs.details — a second plaintext copy of customer credentials.

### Third parties
- None (no analytics/email/SMS providers in code).

### Backups
- **backend/db-backup/backup_20260412_163011.sql (~3.4MB), backup_20251228_205252.sql (~505KB), admin_backup.sql (~139KB) are COMMITTED TO GIT** and contain production data: user emails + bcrypt hashes, customer PII, Aadhaar/PAN/bank accounts/salaries, case notes with customer document passwords, audit logs with IPs/UAs. reset-db.sql is a truncate script. `.gitignore` ignores `backup/` but NOT `db-backup/` — which is why they are tracked.
- No backup encryption; no backup access control beyond repo access.

### Retention / erasure
- **No TTL/cleanup/retention job anywhere** (no cron/setInterval). Export ZIPs, BullMQ jobs, audit/error logs accumulate forever.
- Case deletion (crm.service.ts:1383-1420) cascades to most case data, but NOT audit_logs/error_logs entries, NOT already-generated export ZIPs, NOT Redis jobs.
- User deletion (users.controller.ts:249-285) fails with FK 23503 for any user who created cases/documents/announcements (no cascade on created_by columns); even on success the user's email/name persists in audit_logs details.
- **No self-service export/erasure endpoint — no GDPR/DPDP right-to-erasure compliance.**

---

## Phase 3 — Security Controls Checklist

### Secrets management
- **FAIL — Critical.** Committed production DB dumps with bcrypt hashes + PII (see Phase 2 Backups).
- **FAIL — Critical.** Fallback secrets: `docker-compose.txt:12,55,58-59` (changeme_secure_password, change_this_in_production_*); `backend/src/config/env.ts:23-24` ('dev_secret', 'dev_refresh_secret' fallbacks); env.ts:14 empty-string DB password fallback. No startup validation of env.
- **FAIL.** `scripts/create-default-admin.ps1:10-11` — hardcoded default admin admin@gmail.com with a **2-character password** [REDACTED], echoed to console; bypasses the API's min-8 validator by inserting via psql directly (line 117).
- PASS: no `.env` files committed; .gitignore covers them. Git history shows only dev-placeholder env values beyond the dumps above.
- No secrets manager — env vars on host only.

### Authentication & sessions
- PASS: bcryptjs, 10 rounds (utils/password.ts:1-3). 10 is the floor; 12+ preferred.
- PARTIAL: JWT — alg confusion not possible with jsonwebtoken v9 + string secret (utils/jwt.ts:6,18); refresh rotation with Redis match (auth.controller.ts:109-134); logout revocation works. BUT: access token expiry 24h (env.ts:25) contradicts README's "15min" and cookie maxAge 15min (auth.controller.ts:71) — stolen Bearer tokens live 24h. **No session revocation on password change** (users.controller.ts:113-193 never touches Redis).
- **FAIL: no MFA anywhere** (zero matches for mfa/totp/2fa).
- **FAIL: no password-reset flow** (auth.routes.ts has only login/refresh/logout/me). Admin-only password changes, no current-password check, no session invalidation.
- PASS (with caveat): tokens in httpOnly sameSite=strict cookies; frontend uses withCredentials (lib/api.ts:10); no localStorage tokens. Caveat: `secure` flag off outside production, and production serves HTTP-only — cookies cross the network in cleartext.

### Authorization & multi-tenant isolation
- PASS: RBAC middleware is DB-backed per request, parameterized (rbac.middleware.ts:14-37). Admin routes all permission-gated (admin.routes.ts:36+).
- **FAIL — architectural: NO tenant model exists at all** (zero matches for tenant/org_id). The product as built is single-organization; selling it as multi-customer SaaS on one shared instance is impossible without a rewrite. Per-customer deployment is the only current option, which changes the compliance story.
- **FAIL — High: IDORs on CRM sub-resources.** Ownership is checked on getCaseById (crm.service.ts:326-358) and list queries, but NOT on: GET /cases/:id/documents (crm.controller.ts:376-398 to crm.service.ts:549-563), GET /cases/:id/notes (crm.controller.ts:508-512), GET /cases/:id/timeline (:540-544), GET /cases/:id/notifications (:673-679), GET /cases/:id/customer-detail-sheet (:809-819 — **Aadhaar/PAN/bank data readable by any user with crm.case.view**), and WRITE paths POST /cases/:id/status (:295-311), POST /cases/:id/assign (:231-267), POST /cases/:id/documents (:329), DELETE /cases/:id (:269-276, service checks existence only). Any authenticated user holding the coarse permission can read/mutate **any** case in the system.
- **FAIL:** export download has no job-ownership check (crm.controller.ts:1114-1140) — cross-user bulk PII theft via jobId enumeration.
- FRAGILE: admin bypass relies on case-sensitive role-name comparison against 'admin'/'super_admin' (crm.service.ts:326) while the seed script creates role 'Admin' (scripts/setup-admin.ps1:41) — real admins get restricted; any role literally named 'admin' bypasses all row-level checks.
- PARTIAL: all routers require auth; some task/note routes rely on service-layer checks (implemented); /api/tasks/analytics and /api/notes/my are auth-only.

### Injection / input validation
- PASS: SQL — all dynamic fragments reviewed; user values always via $N params; ORDER BYs are literals; zod constrains IDs.
- PASS: XSS — single dangerouslySetInnerHTML injects generated CSS, not user content (hierarchy/page.tsx:1048); React escaping elsewhere.
- PASS: no command execution, no SSRF surface (no server-side fetch of user URLs).
- **FAIL — High: path traversal in CRM uploads** — filename built as timestamp-originalname, unsanitized, so a `../` in originalname gives arbitrary file write as the backend user (crm.controller.ts:50,343,456,613). Announcements sanitize correctly (announcements.controller.ts:22), proving the CRM path is an oversight.
- **FAIL — High: no file-type validation on CRM uploads** (crm.routes.ts:12-17, no fileFilter; any MIME up to 10MB x10).

### Transport & storage encryption
- **FAIL — High: no TLS.** nginx listens on :80 only, no ssl directives, no HSTS (nginx/conf.d/default.conf:10). helmet() bare defaults (app.ts:22). Session cookies + all customer PII cross the network in cleartext.
- **FAIL: no field-level encryption** (no pgcrypto; all PII/IDs/financials plaintext in Postgres, Redis, files, logs, backups).
- DB at-rest encryption: not determinable from repo (infra-level, no IaC). OPEN QUESTION for deployment.
- Internal service calls (backend to postgres/redis) plaintext on docker bridge — acceptable while network stays private; Redis has no auth.

### API security
- **FAIL — Critical: zero rate limiting** anywhere (no express-rate-limit dep; no nginx limit_req). /api/auth/login fully unthrottled — trivial brute force, compounded by the 2-char default admin password.
- **FAIL — High: CORS reflects ANY origin with credentials:true** (app.ts:36-42, "Allow all for development" fallthrough).
- PASS: no mass assignment — controllers destructure explicit fields; role assignment only via dedicated permission-gated endpoint.
- PARTIAL: error middleware returns raw err.message to clients ungated by NODE_ENV (error.middleware.ts:72-74) — pg errors can leak schema internals; stack traces not sent to client (good) but request bodies persisted to error_logs (bad).
- INTEGRITY: tsc-errors.txt records 29 compile errors; ExportService.getExportArchivePath / checkExportJobFilepathStatus are called (crm.controller.ts:1089,1122) but **do not exist** — export status/download routes 500 at runtime.

### Infrastructure
- PARTIAL: Postgres/Redis have no host port mappings (good), but backend :4000 and frontend :3000 are published directly to the host, **bypassing nginx** (docker-compose.txt:46-47,85-86) — and CORS allows any origin, so the API is directly reachable.
- FAIL: default-credential fallbacks in compose (above).
- No public cloud buckets (no cloud SDK). DB internet exposure: not determinable from repo. OPEN QUESTION.
- **Dependency audit (npm audit, 2026-08-05):** Backend: 6 high (multer DoS x2, lodash code-injection/proto-pollution, minimatch/brace-expansion/picomatch ReDoS, tmp path traversal), 4 moderate, 2 low. Frontend: 9 high (axios SSRF + auth-bypass, next DoS x2, sharp/libvips CVEs, form-data CRLF, postcss XSS/file-read, js-yaml/minimatch/picomatch/brace-expansion ReDoS), 1 moderate. No criticals. multer DoS is directly relevant to the upload surface; axios SSRF advisory relevant to any server-side axios usage.

---

## Phase 4A — Documentation & license compliance

- **No Terms of Service, Privacy Policy, or Cookie Policy anywhere** in repo, docs, or frontend pages (frontend has only login/logkavi/protected routes — no public legal pages). FAIL.
- Policy-vs-code mismatch: N/A — no policy exists to mismatch. Everything found in Phase 1 (Aadhaar, PAN, bank accounts, salaries, employee photos, IPs/UAs in logs) is currently collected with **zero disclosed notice**.
- No documented retention/deletion policy; code confirms none exists (Phase 2).
- No user data export/erasure mechanism for end customers. FAIL.
- **No LICENSE file** for the codebase itself. FAIL — for a product to be sold, proprietary licensing must be explicit.
- Dependency license audit (direct deps, from installed node_modules): backend all MIT/BSD-2-Clause; frontend all MIT/ISC **except jszip@3.10.1 = "(MIT OR GPL-3.0-or-later)"** — dual-licensed, MIT may be elected, so compliant in practice, but flag for the record and document the election. No AGPL/SSPL/LGPL found. PASS with one flag.
- EU/UK users: none identifiable; product handles Indian identifiers (Aadhaar/PAN/UAN/IFSC) — **India DPDP Act 2023 is the clearly-relevant regime** (the prompt's checklist doesn't list it; noting as factual mapping). No consent mechanism exists anywhere in code.
- No DPA template; subprocessors = hosting provider only (no third-party processors in code).

## Phase 4B — Certification & framework relevance map
(carried into final report; factual mapping, not legal advice)
