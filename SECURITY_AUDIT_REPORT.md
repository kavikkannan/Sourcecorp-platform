# Security & Data Audit Report — 2026-08-05

**Target**: SourceCorp Platform v1.0.0 (Express 5 + PostgreSQL + Redis + BullMQ backend, Next.js 15 frontend, nginx, docker-compose)
**Method**: read-only source audit, dependency audit (`npm audit`), git-history review. Working notes with full evidence: `AUDIT_FINDINGS.md`.

---

## Executive Summary

This platform handles some of the most sensitive data categories that exist in the Indian market — Aadhaar numbers, PAN numbers, bank account numbers with IFSC, salaries, loan applications, KYC documents, and even customers' own document passwords (CIBIL / bank-statement / Aadhaar PDF passwords) that staff routinely type into case notes. Every one of those data categories is stored in **plaintext**, served over **HTTP with no TLS**, behind a login with **no rate limiting, no MFA, and no password-reset flow**, with authorization gaps that let any staff user read any customer's Aadhaar/PAN/bank detail sheet. As it stands, **this is not safe to sell to, or operate for, any customer** — a security-conscious buyer's diligence would end at the first finding below.

The three most urgent issues: **(1)** full production database dumps — including real customer PII, government IDs, bank details, bcrypt password hashes, and customer document passwords — are **committed to this git repository** (`backend/db-backup/*.sql`); anyone with repo access has a copy of the production database, and if this repo is ever sold/transferred, that data goes with it. **(2)** Login is completely unthrottled and a setup script creates a default admin with a **2-character password**, while fallback JWT secrets in code and docker-compose mean a misconfigured deployment signs tokens with publicly-known keys. **(3)** There is **no multi-tenant model at all** — the product as architected is a single-organization internal tool; it cannot be sold as multi-customer SaaS on a shared instance without a foundational rewrite.

Positives worth noting: SQL injection posture is clean (parameterized queries throughout), XSS surface is minimal, no third-party trackers exist, RBAC is DB-backed and server-enforced, tokens live in httpOnly SameSite=strict cookies, and the dependency licenses are nearly all permissive. The remediation roadmap below is ordered so that the data-exposure emergencies are handled before any code hardening begins.

---

## Data Inventory Table

| Data Type | Classification | Collection Point | Storage Location | Encrypted? | Retention |
|---|---|---|---|---|---|
| Customer name, email, phone | PII | POST /api/crm/cases (crm.validator.ts:4-24) | `crm_schema.cases` (plaintext); audit_logs; export ZIPs; committed DB dumps | No | Forever (no retention job) |
| Loan type, loan amount | Sensitive | POST /api/crm/cases | `crm_schema.cases`, eligibility_calculations (plaintext) | No | Forever |
| Aadhaar, PAN, bank account no., IFSC, UAN, salary, DOB, addresses | Sensitive/regulated | POST /cases/:id/customer-detail-sheet (Excel upload, crm.service.ts:1214-1244) | `customer_detail_sheets.detail_data` JSONB (plaintext); change_requests JSONB; committed dumps | No | Forever |
| KYC/loan documents (uploaded files) | Sensitive | Case create / document / note / schedule uploads (multer) | `uploads/documents/` flat dir (docker volume); copied into export ZIPs | No | Forever (no cleanup) |
| Customer document passwords (CIBIL/bank/Aadhaar PDF) | Auth/secret (customer's own credentials) | Typed by staff into case notes / scheduled messages | `case_notes`, `case_notifications`, duplicated into `audit_logs.details`, committed dumps | No | Forever |
| Income, EMIs/obligations, CAM financial data | Sensitive | /api/finance/eligibility, /obligation, /cam | finance_schema tables, cam_data JSONB versioned (all versions kept) | No | Forever |
| Staff user names, emails | PII | admin user CRUD | `auth_schema.users`; audit_logs; recognitions | No | Forever |
| Staff passwords | Auth/secret | login, user create/update | `password_hash` only (bcrypt 10) — **but also error_logs.request_body on failed requests (plaintext)** | Hashed (except error_logs leaks) | Forever |
| JWT refresh tokens | Auth/secret | login/refresh | Redis `refresh_token:{userId}` plaintext, 7-day TTL | No | 7 days |
| Employee photos | PII | Recognitions/announcements image upload | `uploads/recognitions/`, served **unauthenticated** (app.ts:60-63) | No | Forever |
| IP address, user-agent | PII | Every mutation (audit), every error (error_logs), login | `audit_logs`, `error_logs` | No | Forever |
| Failed-request bodies (may contain passwords, full customer PII) | Auth/secret + PII | Any throwing endpoint | `audit_schema.error_logs.request_body` JSONB (error.middleware.ts:19-35) | No | Forever |
| Export job payloads (userId, caseIds) | Internal IDs | POST /cases/export | Redis BullMQ jobs, `removeOnComplete:false` (queue.service.ts:33-37) | No | Indefinite |
| CAM/obligation draft form data | Sensitive | financial-tools pages | **Browser localStorage** (cam/page.tsx:162, obligation/page.tsx:187) | No | Until cleared |

---

## Findings

### [CRITICAL] Production database dumps committed to the git repository
- **Location**: `backend/db-backup/backup_20260412_163011.sql` (~3.4MB), `backup_20251228_205252.sql` (~505KB), `admin_backup.sql` (~139KB); tracked at HEAD, added in commit `a5f8db9`.
- **Issue**: Full pg_dump-style copies of production tables are version-controlled. `.gitignore` excludes `backup/` but not `db-backup/`.
- **Impact**: Anyone with repo read access (developers, contractors, a future buyer of this codebase, anyone who clones it if the remote ever leaks) obtains: every user's email + bcrypt password hash (crackable offline, especially the weak ones); every customer's name/phone/email/loan amount; Aadhaar/PAN/bank account/salary JSON; case notes containing **customers' CIBIL and bank-statement passwords in plaintext** [REDACTED]; and audit logs with IPs. This is simultaneously a data breach-in-waiting, a DPDP Act violation-in-waiting, and a deal-killer in any acquisition diligence. Selling this repo sells a copy of the production database with it.
- **Evidence**: `git ls-files` lists all four files; dumps contain `COPY auth_schema.users (... password_hash ...)` (admin_backup.sql:1265), `COPY crm_schema.customer_detail_sheets` with Aadhaar/PAN/bank fields, and audit_log rows like `case.note_add ... {"note": "CIBIL PASSWORD : [REDACTED]"}`.
- **Fix**: (1) Remove the files from the repo **and from git history** (git filter-repo / BFG) — deleting at HEAD is not enough; (2) rotate every user password and treat all credentials in the dumps as compromised; (3) notify affected customers per DPDP obligations if the repo was ever shared; (4) add `db-backup/` to `.gitignore`; (5) store future backups encrypted, outside the repo, with access controls.

### [CRITICAL] No rate limiting anywhere — login brute-force is trivial
- **Location**: `backend/src/routes/auth.routes.ts:9` (login); no `express-rate-limit` in `backend/package.json`; no `limit_req` in `nginx/conf.d/default.conf`.
- **Issue**: Zero throttling, lockout, or CAPTCHA on any endpoint, including authentication.
- **Impact**: Unlimited offline-speed password guessing against any account. Combined with the 2-char default admin password (next finding) and 24h token lifetimes, account takeover is a matter of minutes. No WAF or compensating control exists.
- **Evidence**: `grep -ri "rate.?limit" backend/` → zero matches.
- **Fix**: Add `express-rate-limit` (strict: ~5/min per IP+email on `/api/auth/login`, moderate on all API routes), plus account lockout after N failures, plus nginx `limit_req_zone` as a second layer.

### [CRITICAL] Default admin account with 2-character password, and fallback JWT secrets in code
- **Location**: `scripts/create-default-admin.ps1:10-11` (admin@gmail.com / [REDACTED], 2 chars, echoed to console, inserted via psql bypassing the min-8 validator); `backend/src/config/env.ts:23-24` (`'dev_secret'` / `'dev_refresh_secret'` fallbacks); `docker-compose.txt:12,55,58-59` (`changeme_secure_password`, `change_this_in_production_*` fallbacks).
- **Issue**: Three layers of "if you forget to configure it, it deploys with publicly-known secrets." There is no startup validation that fails closed.
- **Impact**: A stock deployment is ownable by anyone who has read this repo: log in as the default admin (2-char password guessable in seconds given no rate limiting), or forge JWTs with the published fallback secrets and impersonate any user including admins. The committed dumps confirm this exact admin email exists in production data.
- **Evidence**: see locations above; `backend/src/validators/admin.validator.ts:7` requires min 8 but the script bypasses the API.
- **Fix**: Make `env.ts` throw at boot if `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DB_PASSWORD` are unset or match known defaults; remove all `:-default` fallbacks from compose; delete the default-admin script or force a random generated password printed once; force password change on first login; rotate production JWT secrets (invalidating all sessions) since the fallback values are public.

### [HIGH] IDOR: any staff user can read/mutate any customer's case data, including Aadhaar/PAN/bank sheets
- **Location**: Reads — `crm.controller.ts:376-398` (documents list), `:508-512` (notes), `:540-544` (timeline), `:673-679` (notifications), `:809-819` (**customer-detail-sheet**); Writes — `:295-311` (status), `:231-267` (assign), `:329` (upload document), `:269-276` (delete case). Services called (`crm.service.ts:549-563, 606-625, 953, 1383-1396`) filter by case_id only.
- **Issue**: `getCaseById` enforces creator/assignee/subordinate access (crm.service.ts:326-358), but the sub-resource endpoints check only the coarse permission (e.g. `crm.case.view`) — never case ownership/scope.
- **Impact**: Any authenticated staff member with basic CRM permissions can pull **any** customer's detail sheet (Aadhaar, PAN, bank account, salary), notes (which contain document passwords), and documents by incrementing/enumerating case UUIDs; can change statuses, reassign, or delete other teams' cases. For a financial-services platform this is a reportable-breach-class authorization failure.
- **Evidence**: contrast `downloadDocument` (crm.controller.ts:422-426 — *does* check case access) with `getDocuments` (:376-398 — does not), proving the check exists but was not applied consistently.
- **Fix**: Centralize the case-access check from `getCaseById` and call it at the top of every case sub-resource handler (read and write). Add integration tests asserting 403 for out-of-scope case IDs on every endpoint.

### [HIGH] Cross-user export download — bulk PII theft via jobId
- **Location**: `crm.controller.ts:1114-1140` (`GET /api/crm/cases/export/download/:jobId`).
- **Issue**: Permission-gated (`crm.case.export`) but no check that the requesting user owns the job. Export ZIPs contain full case JSON + all uploaded documents (export.service.ts:1000-1039) and are never cleaned up.
- **Impact**: One malicious staff user can download every other user's exports — effectively a bulk exfiltration channel of the entire customer base over time. (Note: this route also 500s today because `ExportService.getExportArchivePath`/`checkExportJobFilepathStatus` don't exist — `crm.controller.ts:1089,1122`, `tsc-errors.txt` — but the missing ownership check must be fixed when the route is repaired.)
- **Fix**: Store job→user mapping; verify ownership (or admin) before serving; add ZIP expiry + deletion.

### [HIGH] Path traversal in CRM file uploads → arbitrary file write
- **Location**: `crm.controller.ts:50, 343, 456, 613` — filename built as `{timestamp}-{file.originalname}` with no sanitization, then `path.join(uploadDir, filename)` + `fs.writeFile`.
- **Issue**: `file.originalname` is client-controlled; `../../` sequences escape `uploads/documents`.
- **Impact**: An authenticated user with note/document upload permission can write arbitrary files anywhere the backend process can write — overwrite app code in the container for RCE on next reload, drop a webshell-style asset, corrupt the DB volume mount. The announcements controller already sanitizes correctly (announcements.controller.ts:22), so this is a known pattern that was missed in CRM.
- **Fix**: `path.basename()` + an allowlist regex on the filename (or generate a UUID filename and store the original name in DB only); verify the resolved path stays under the upload dir.

### [HIGH] No TLS anywhere — session cookies and Aadhaar data cross the network in cleartext
- **Location**: `nginx/conf.d/default.conf:10` (listen 80 only; no ssl_* directives; no HSTS); `auth.controller.ts:66-69` (`secure` cookie flag only in production — but production has no TLS).
- **Issue**: The only deployment path is plaintext HTTP.
- **Impact**: Anyone on-path (office network, ISP, hosting provider network) can sniff session cookies → full account takeover, and read every Aadhaar/PAN/bank field in transit. Also fails every enterprise security questionnaire instantly.
- **Fix**: Terminate TLS at nginx (or a load balancer), redirect 80→443, enable HSTS, set `secure` unconditionally.

### [HIGH] CORS reflects any origin with credentials
- **Location**: `backend/src/app.ts:36-42` — origin callback falls through to `callback(null, true)` ("Allow all for development") for every origin, with `credentials: true`.
- **Issue**: CORS as an access control is disabled; any website's JavaScript can make authenticated cross-origin requests and read responses (SameSite=strict currently limits cookie-based CSRF, but Bearer-header auth is also accepted — auth.middleware.ts:16-17 — and any future SameSite relaxation turns this into full cross-site session riding).
- **Fix**: Allowlist the real frontend origin(s) from env; reject all others; keep `credentials: true` only for the allowlist.

### [HIGH] Plaintext passwords and full customer PII persisted to error_logs on any failed request
- **Location**: `backend/src/middleware/error.middleware.ts:19-35` → `audit_schema.error_logs.request_body` (schema.sql:115-128).
- **Issue**: On any unhandled error, the entire request body is stored unredacted.
- **Impact**: A single failing login or admin user-create writes a **plaintext password** to the database; a failing case/detail-sheet request writes Aadhaar/PAN/bank JSON. Over time this table becomes a credential-and-PII sink readable by anyone with DB or admin access, and it's included in every backup/dump.
- **Fix**: Redact before persisting — drop `password`/`token`/secret-shaped keys, and ideally store only a schema-safe subset of the body (or none for auth routes). Purge the existing table.

### [HIGH] Staff routinely store customers' document passwords in case notes — and the platform encourages it
- **Location**: Data observed in committed dumps: dozens of `case.note_add` / `case.schedule_notification` audit rows containing "CIBIL PASSWORD: [REDACTED]", "Bank statement password: [REDACTED]", "EAADHAR PASSWORD: [REDACTED]".
- **Issue**: Free-text notes (crm.service.ts:598, notifications) have no guardrails; notes are duplicated into audit_logs.details, doubling exposure.
- **Impact**: The platform is a plaintext vault of customers' third-party credentials. Any read-scope bug (see IDOR finding), any dump, any log export exposes them; this also likely violates the customers' banks'/bureaus' terms and creates liability the buyer will inherit.
- **Fix**: Product decision required: prohibit and detect (regex-scan notes for password-like patterns and warn/block), or provide a proper encrypted secrets field (envelope encryption, masked display, access-audited). Purge existing passwords from notes/audit logs.

### [MEDIUM] No session revocation on password change; no password-reset flow; no MFA
- **Location**: `users.controller.ts:113-193` (updates password_hash, never deletes `refresh_token:{id}` from Redis); `auth.routes.ts` (login/refresh/logout/me only); zero MFA anywhere.
- **Impact**: An admin resetting a compromised user's password does not kill the attacker's sessions (they live up to 7 days via refresh). No self-service reset means admins see/handle passwords. No MFA for a platform holding Aadhaar data is below the bar any financial-services customer will set.
- **Fix**: Delete the user's Redis refresh token on password change/admin reset; add a time-limited single-use reset-token flow; add TOTP MFA (at minimum for admin roles).

### [MEDIUM] No encryption at rest for sensitive fields; no field-level encryption
- **Location**: `schema.sql` (no pgcrypto); all PII/financial columns plaintext (see Data Inventory).
- **Impact**: DB dump = full plaintext breach (already realized via the committed backups). Disk/volume theft, snapshot leaks, or any SQL read bug expose everything.
- **Fix**: Enable volume/managed-disk encryption at deploy (document it); add application-level envelope encryption for the highest-risk fields (aadhar_number, pan_number, bank_account_number, detail_data JSONB) with keys in a secrets manager. Hash or tokenize Aadhaar where full value isn't operationally required (note: Aadhaar storage is also regulated — see compliance section).

### [MEDIUM] No data retention or erasure capability
- **Location**: No cron/TTL/cleanup anywhere in backend; export ZIPs and BullMQ jobs retained forever (queue.service.ts:33-37); user deletion FK-fails for content creators (users.controller.ts:249-285 — no cascade on `cases.created_by` etc.); audit_logs keep deleted users' email/name (:276); case deletion leaves audit residue and existing export ZIPs.
- **Impact**: Cannot honor a customer's erasure request end-to-end (DPDP/GDPR-class obligation); indefinite accumulation of breachable data.
- **Fix**: Define retention periods per data class; add cleanup jobs for export ZIPs/queue jobs/error_logs; fix FK cascades or soft-delete+anonymize users; add a documented per-customer purge procedure.

### [MEDIUM] Vulnerable dependencies (npm audit)
- **Location**: backend — 6 high: `multer` DoS x2 (directly reachable via upload endpoints), `lodash` code-injection/proto-pollution, `minimatch`/`brace-expansion`/`picomatch` ReDoS, `tmp` path traversal; frontend — 9 high: `axios` SSRF + auth-bypass, `next` DoS x2, `sharp`/libvips CVEs, `form-data` CRLF, `postcss` XSS/file-read, others.
- **Impact**: Mostly DoS-class, but multer DoS is exposed through the app's own upload surface and axios/next advisories affect the frontend server.
- **Fix**: `npm audit fix` where non-breaking; upgrade multer to latest 2.x, axios past the fixed version, next to latest 15.x patch; add Dependabot/Renovate.

### [MEDIUM] Backend and frontend ports published directly to host, bypassing nginx
- **Location**: `docker-compose.txt:46-47` (4000:4000), `:85-86` (3000:3000).
- **Impact**: API reachable without the proxy's (minimal) header controls; combined with wildcard CORS, the attack surface is the raw Express app. Redis has no auth (fine only while truly internal).
- **Fix**: Remove host port mappings for backend/frontend; expose only nginx 80/443.

### [LOW] Raw error messages returned to clients
- **Location**: `error.middleware.ts:72-74` (ungated `err.message`); also crm.controller.ts:899,914,975,1008.
- **Impact**: pg/driver messages can leak schema internals aiding further attack.
- **Fix**: Generic 500 message in production; detailed errors only in logs.

### [LOW] Unauthenticated image endpoints + health endpoint info leak
- **Location**: `app.ts:60-63` (announcement/recognition images public — employee photos), `:50-56` (`/health` leaks NODE_ENV); inactive-announcement image check commented out (announcements.controller.ts:290-292).
- **Fix**: Authenticate recognition images; strip environment from /health response.

### [LOW] Customer financial drafts in browser localStorage
- **Location**: `frontend/.../financial-tools/cam/page.tsx:162`, `obligation/page.tsx:187`.
- **Impact**: Any future XSS = read of draft financial data; data persists on shared machines.
- **Fix**: Server-side drafts or sessionStorage with clear-on-logout.

### [LOW] Role-name-based admin bypass is fragile and case-sensitive
- **Location**: `crm.service.ts:326` compares role name to 'admin'/'super_admin'; seed creates 'Admin' (scripts/setup-admin.ps1:41).
- **Impact**: Real admins are wrongly restricted (availability); a role literally named 'admin' silently bypasses all row-level security (privilege escalation via role management).
- **Fix**: Gate on an immutable permission flag, not role display names.

### [LOW] "Secret" admin login path /logkavi is security through obscurity
- **Location**: `nginx/conf.d/default.conf:58-69`; `frontend/src/app/logkavi/page.tsx:6` (just redirects to /login).
- **Impact**: None directly — but it's published in the repo and provides no control. Remove it; protect admin with MFA/IP allowlisting instead.

### [INFO] Export feature broken at runtime (integrity, not security)
- **Location**: `crm.controller.ts:1089,1122` call non-existent `ExportService` methods; 29 errors in `tsc-errors.txt`; `package.json` build script uses `tsc || true`, shipping broken code silently.
- **Fix**: Fix the methods, make `tsc` failures fail the build, add CI.

---

## Legal & Compliance Findings

(Phase 4A — factual mapping from the repo)

- **No Terms of Service, Privacy Policy, or Cookie Policy exists** anywhere in the repo or the frontend (no public legal pages at all). The platform collects Aadhaar, PAN, bank account numbers, salaries, employee photos, and IPs with **zero disclosed notice or consent mechanism** — the single largest legal gap for a paid product.
- **No documented retention/deletion policy**, and the code implements none (verified: no TTL/cleanup/erasure paths).
- **No data export/erasure mechanism** for data subjects; user deletion is broken for content-creators (FK failures) and leaves PII in audit logs.
- **No LICENSE file** — for a product intended to be sold, proprietary licensing terms must be added before any distribution.
- **Dependency licenses**: all direct dependencies are MIT/BSD-2-Clause/ISC except **`jszip@3.10.1` ("MIT OR GPL-3.0-or-later")** — dual-licensed; elect MIT and document the election. No AGPL/SSPL/LGPL found. **Pass with one documented flag.**
- **No DPA template** exists. Actual subprocessor list is short (no third-party processors in code — just the hosting provider), which makes a DPA easy to write once one is drafted.
- **India DPDP Act 2023 is the clearly relevant regime** (Aadhaar/PAN/UAN/IFSC data, Indian financial workflows). Factual notes for counsel: collecting Aadhaar numbers implicates the Aadhaar Act's storage restrictions (full Aadhaar storage by non-licensed entities is restricted — this needs legal review, not just engineering); DPDP requires consent notice, purpose limitation, breach notification, and erasure — none currently implemented. **This is a mapping of facts, not a legal conclusion.**
- GDPR/CCPA: no EU/UK/California user base identifiable from code or data; relevance is contingent on future customers.

## Certifications & Framework Relevance

| Framework | Rating | Reason (tied to actual findings) |
|---|---|---|
| **SOC 2 (Type I/II)** | **Likely Relevant** | Will be demanded by any enterprise/financial buyer. Current gaps found: no access-log retention policy, no change-management process (no CI, `tsc \|\| true` builds), no incident-response plan, no MFA, no encryption at rest — all standard SOC 2 control failures today. |
| **ISO 27001** | **Possibly Relevant** | Only if selling internationally/enterprise; same control gaps apply. |
| **PCI-DSS** | **Not Applicable** | No payment card data anywhere in Phase 1/2 findings — no card numbers, no processor integration. Do not add card handling without scoping review. |
| **HIPAA** | **Not Applicable** | No health data found. |
| **GDPR** | **Not currently applicable** | No EU/UK data subjects identified; revisit if sales target EU. |
| **CCPA/CPRA** | **Not currently applicable** | No California-resident data identified; revisit on US expansion. |
| **India DPDP Act 2023** (law, not cert) | **Likely Relevant** | Indian identifiers (Aadhaar/PAN/UAN) and Indian customer financial data are collected at scale; no consent/notice/erasure/breach-notification mechanisms exist in code. |
| **FedRAMP** | **Not Applicable** | No US government customers indicated. |

> This section is a factual mapping based on code and data findings, not legal advice. Confirm all compliance and certification decisions with a qualified attorney or compliance professional before launch. SOC 2 and ISO 27001 in particular are multi-month efforts requiring a qualified auditor; this audit only flags which are worth planning for.

---

## Prioritized Remediation Roadmap

### 1. Do immediately (before selling to anyone)
1. **Purge `backend/db-backup/` from the repo AND from git history** (filter-repo/BFG); treat all credentials in the dumps as compromised — rotate user passwords and JWT secrets; assess DPDP breach-notification duty if the repo was ever shared. Add `db-backup/` to `.gitignore`.
2. **Add rate limiting** on `/api/auth/login` and globally (express-rate-limit + nginx limit_req).
3. **Remove all default/fallback secrets** — fail boot if JWT/DB secrets are unset; delete or fix the 2-char default admin script; force-rotate production secrets.
4. **Fix the case-authorization IDORs** — centralize the case-access check across every CRM sub-resource endpoint (read and write), and add job-ownership check to export downloads.
5. **Fix upload path traversal** (sanitize filenames) and add file-type/size allowlists to CRM uploads.
6. **Redact request bodies in error_logs** (passwords/tokens at minimum) and purge the existing table.
7. **Decide the tenancy story**: the product has no tenant model. Either commit to per-customer isolated deployments (and document that), or a multi-tenant rewrite is required before any shared-instance SaaS sale. This is a business/architecture gate, not a patch.

### 2. Do before first paying customer
8. Terminate TLS at nginx, redirect HTTP→HTTPS, HSTS, `secure` cookies unconditionally.
9. Lock CORS to the real frontend origin(s).
10. Session revocation on password change; password-reset flow; TOTP MFA at least for admins.
11. Stop staff from storing customer document passwords in notes (detection/blocking + encrypted secrets field); purge existing ones from notes and audit logs.
12. Draft and publish ToS, Privacy Policy, Cookie Policy matching what Phase 1 actually collects; add consent notice; add a proprietary LICENSE. Get counsel review on Aadhaar storage legality specifically.
13. Close host ports 3000/4000 (nginx-only ingress); add Redis auth; enable disk/volume encryption; document DB at-rest encryption.
14. Fix vulnerable dependencies (multer, axios, next, sharp at minimum); make `tsc` fail the build; add CI with audit + typecheck + tests.
15. Encrypt high-risk fields at application level (Aadhaar/PAN/bank account) with keys in a secrets manager.

### 3. Do before enterprise customers / scale
16. Retention engine: TTL/cleanup for export ZIPs, queue jobs, error logs; end-to-end per-customer data purge; fix user-deletion cascades/anonymization.
17. DPA template listing actual subprocessors; breach-response runbook; access-review process.
18. Field-level audit of who viewed sensitive sheets (read-access audit trail, not just writes).
19. Begin SOC 2 Type I readiness (access logging, change management, incident response are the long poles); ISO 27001 only if international enterprise pipeline justifies it.
20. Security regression test suite: IDOR tests on every endpoint, auth-boundary tests, upload-abuse tests — run in CI on every change.
