# SaaS Data & Security Audit — Agent Instructions

Paste this whole file as your prompt/task in Claude Code (with Kimi K2 as the
model). It's written to be self-contained and explicit, since Kimi doesn't
share Claude's default agentic conventions — assume nothing is implied.

---

## ROLE

You are a senior application security auditor performing a pre-launch audit
of a codebase that its owner intends to sell as a multi-customer SaaS
product. Your job is **audit and report only** — do not fix, refactor, or
modify any code in this pass. You are read-only unless explicitly told
otherwise in a later prompt.

## OPERATING RULES (follow these exactly)

1. **Work in phases, in order** (below). Do not skip ahead.
2. **Cite evidence for every finding** — file path + line number(s). Never
   assert a problem without having actually read the relevant code.
3. **Never print secret values.** If you find an API key, password, token,
   or credential, report *that one exists, where, and what kind* — redact
   the actual value as `[REDACTED]`.
4. **Save progress as you go.** After each phase, append your findings to
   `AUDIT_FINDINGS.md` in the repo root rather than holding everything in
   memory until the end. If you get interrupted or run low on context,
   this file should let you (or a fresh session) resume without redoing work.
5. **Don't assume — verify.** If you can't confirm something from the code
   (e.g. "is this bucket public?"), say so explicitly as an open question
   rather than guessing.
6. **Rate every finding's severity** using the rubric in Phase 5 before
   writing it up.
7. When you finish all phases, produce the final report exactly in the
   format specified in Phase 5, saved as `SECURITY_AUDIT_REPORT.md`.

---

## PHASE 0 — Reconnaissance

Before diving in, build a map of the codebase so later phases are targeted,
not blind:

- Run `find . -type f -name "*.md" -o -name "README*"` and read any
  architecture/design docs.
- List all top-level services/apps (monorepo? single app? microservices?).
- Identify the stack: language(s), framework(s), database(s), cache layer,
  queue/broker, cloud provider, IaC tool (Terraform/Pulumi/CDK/none).
- Identify entry points: API routes/controllers, webhook handlers, admin
  panels, background jobs/cron.
- List all `.env*`, config files, `docker-compose.yml`, CI/CD config
  (`.github/workflows`, `.gitlab-ci.yml`, etc.), and IaC files.

Write a short "System Map" section to `AUDIT_FINDINGS.md` summarizing this
before moving on.

---

## PHASE 1 — Data Inventory (what is collected)

Find every point where user/customer data enters the system. Search for:

```
# form inputs / request parsing
grep -rn "req.body\|req.query\|req.params\|request.POST\|request.GET\|FormData\|@RequestBody" --include="*.{js,ts,py,rb,go,java}" .

# file uploads
grep -rn "multer\|formidable\|UploadFile\|multipart" .

# cookies / sessions
grep -rn "cookie\|session\[" .

# third-party trackers/analytics/error reporting (these silently collect data too)
grep -rniE "segment|mixpanel|amplitude|posthog|google-analytics|gtag|sentry|logrocket|hotjar|intercom|fullstory" .
```

For each collection point found, record in `AUDIT_FINDINGS.md`:
- Where (file:line, route/endpoint)
- What fields are captured
- Classify each field:
  - **PII**: name, email, phone, address, IP address, device ID
  - **Sensitive/regulated**: SSN/national ID, payment card data, health
    data, biometric data, precise geolocation
  - **Auth/secrets**: passwords, API keys, OAuth tokens, session tokens,
    2FA secrets
  - **Behavioral/usage**: clickstream, feature usage, logs sent to
    third parties

---

## PHASE 2 — Storage Mapping (where it ends up, and for how long)

For every data type found in Phase 1, trace it to its resting place:

- **Primary database**: read the schema/migrations directory. For every
  table/collection touching PII or secrets, note the column, its type, and
  whether it looks encrypted/hashed vs plaintext.
- **Cache/session store** (Redis, Memcached): what gets cached, with what
  TTL, is it ever sensitive data cached in plaintext?
- **Files/blob storage** (S3, GCS, local disk): what's uploaded, is it
  scoped per-customer, is the bucket/container public or private?
- **Logs**: `grep -rn "console.log\|logger\.\|log\." .` — check whether any
  log statements print request bodies, headers (esp. `Authorization`),
  passwords, or tokens. This is one of the most common real-world leaks.
- **Third-party services**: for each analytics/error-tracking/email/SMS
  provider found in Phase 1, note exactly what payload gets sent to them.
- **Backups**: find backup scripts/config — are backups encrypted? Who/what
  can access them?
- **Message queues** (SQS, Kafka, RabbitMQ, etc.): does message payload
  contain raw PII?
- **Data retention**: is there any TTL/cleanup job, or does data accumulate
  forever? Is there a way to actually delete a user's data end-to-end
  (required for GDPR/CCPA "right to erasure")?

---

## PHASE 3 — Security Controls Checklist

Go through every item below. For each, state **Pass / Fail / Partial /
Not Applicable**, with evidence.

### Secrets management
- [ ] Any hardcoded API keys, passwords, or tokens in source code
      (`grep -rniE "api[_-]?key|secret|password|token" --include="*.{js,ts,py,rb,go,java,yml,yaml,json}" . | grep -v node_modules`)
- [ ] Check git history for committed secrets, not just current HEAD:
      `git log -p | grep -niE "api[_-]?key|secret|password" | head -100`
- [ ] `.env` files present in repo (should be gitignored, not committed)
- [ ] Is a secrets manager used in production (Vault, AWS Secrets Manager,
      Doppler, etc.) or are secrets just env vars on the host?

### Authentication & session security
- [ ] Passwords hashed with bcrypt/argon2/scrypt (never MD5/SHA1/plaintext)
- [ ] Session tokens/JWTs: expiry set, signed with strong secret, algorithm
      not `none`, refresh token rotation if used
- [ ] Is MFA supported/enforced for any tier?
- [ ] Password reset flow: tokens single-use, time-limited, not guessable

### Authorization & multi-tenant isolation (critical for SaaS)
- [ ] Every database query that touches customer data — is it scoped by
      `tenant_id`/`org_id`/`account_id`? Look for queries that could return
      another customer's rows (this is the single most damaging class of
      bug for a multi-tenant SaaS).
- [ ] IDOR check: can a user access another user's/tenant's resource by
      changing an ID in the URL/request? Sample a few endpoints and trace
      the authz check.
- [ ] Admin/internal routes — are they protected, or reachable if you know
      the URL?
- [ ] Role-based access control: are permission checks enforced server-side
      (not just hidden in the frontend)?

### Input validation / injection
- [ ] SQL injection: any raw string concatenation into queries, or is an
      ORM/parameterized queries used throughout?
- [ ] XSS: is user input escaped on output? Any `dangerouslySetInnerHTML`,
      `innerHTML =`, `render_template_string`, or equivalent with
      unsanitized input?
- [ ] Command injection: any `exec()`, `os.system()`, `child_process.exec`
      fed by user input?
- [ ] SSRF: any server-side fetch of a user-supplied URL (webhooks, image
      fetch, link previews)?
- [ ] File upload: is file type/size validated, are uploads served from a
      non-executable path?

### Transport & storage encryption
- [ ] TLS enforced everywhere (HTTP → HTTPS redirect, HSTS header set)
- [ ] Database encryption at rest enabled (cloud provider setting)
- [ ] Field-level encryption for the most sensitive columns, if applicable
- [ ] Are internal service-to-service calls also over TLS, or plaintext
      on an internal network?

### API security
- [ ] Rate limiting present on auth endpoints and public APIs
- [ ] CORS configuration — is it wildcard (`*`) with credentials allowed?
      (dangerous combination)
- [ ] Mass assignment: can a client set fields like `role`, `isAdmin`,
      `tenant_id` directly via request body that shouldn't be user-settable?
- [ ] API keys/tokens for external API access — scoped permissions, or
      full-access by default?

### Infrastructure
- [ ] Any cloud storage buckets checked for public read/write
- [ ] Database directly reachable from the internet, or only via VPC/private
      network?
- [ ] Default credentials anywhere (default admin password, default DB
      creds still in use)?
- [ ] Dependency vulnerabilities: run the relevant audit tool
      (`npm audit`, `pip-audit`, `bundle audit`, etc.) and list high/critical
      results.

---

## PHASE 4 — Legal & Compliance Audit

You're not a lawyer and must not give legal conclusions. Everything in this
phase is a **factual mapping** — "here's what the code/data shows, here's
what that typically implies" — for an actual attorney or compliance
professional to confirm before launch. Split into two parts.

### 4A. Documentation & license compliance (directly verifiable from the repo)

- [ ] Does a Terms of Service, Privacy Policy, and Cookie Policy exist
      anywhere in the repo/docs/public site content?
- [ ] Does the Privacy Policy's stated data collection match what Phase 1
      actually found being collected? List every mismatch (common gap:
      policy says X, code collects Y).
- [ ] Is there a documented data retention/deletion policy, and does the
      code actually implement it (from Phase 2)?
- [ ] Is there a mechanism for a customer/user to export or delete their
      own data on request?
- [ ] Is there a LICENSE file for your own codebase, and is it appropriate
      (proprietary/closed) for a paid product — not accidentally published
      under an open license?
- [ ] **Open-source dependency license audit**: for every direct
      dependency, identify its license (`npm ls --json`, `pip-licenses`,
      `license-checker`, or equivalent for your stack). Flag any copyleft
      licenses (GPL, AGPL, LGPL, SSPL) — these can force you to open-source
      your own code or otherwise conflict with selling a closed commercial
      SaaS. MIT/BSD/Apache-2.0/ISC are typically fine; flag anything else
      for review.
- [ ] For any EU/UK users found in Phase 1: is there a lawful basis/consent
      mechanism for non-essential tracking (analytics/marketing cookies)?
- [ ] Is there a Data Processing Agreement (DPA) template ready for B2B
      customers, and does it actually list the real subprocessors found in
      Phase 2 (hosting provider, analytics, email/SMS service, etc.)?

### 4B. Certification & framework relevance map

Based **only** on what was actually found in Phases 1–3 (never on
assumption), state which of the following are likely relevant and why.
Rate each: **Likely Relevant / Possibly Relevant / Not Applicable**, with a
one-line reason tied to an actual finding.

- **SOC 2 (Type I/II)** — typically becomes relevant once selling to
  mid-market/enterprise customers, who often require it in procurement.
  Flag if Phase 3 found missing access logging, no change-management
  process, or no incident-response plan — these are SOC 2 control gaps.
- **ISO 27001** — relevant if selling internationally, especially to
  EU/UK enterprise buyers.
- **PCI-DSS** — relevant ONLY if Phase 1/2 found the app directly
  storing/transmitting raw payment card numbers. If payments go through a
  processor (Stripe, Braintree, etc.) and raw card data never touches your
  servers, note that this substantially reduces scope — confirm exact
  scope with the processor's own compliance documentation.
- **HIPAA** — relevant ONLY if health/medical data was found in Phase 1.
- **GDPR** (a law, not a certification) — relevant if any EU/UK personal
  data was found being collected.
- **CCPA/CPRA** (a law, not a certification) — relevant if California
  residents' data is collected and applicable revenue/volume thresholds
  might be met.
- **FedRAMP** — relevant only if targeting US government customers.

State plainly in the report that this list is informational scoping, not a
legal determination, and that certification programs (SOC 2, ISO 27001 in
particular) are multi-month efforts requiring a qualified auditor — the
goal here is just to flag which ones are worth planning for.

---

## PHASE 5 — Final Report

Write `SECURITY_AUDIT_REPORT.md` with this exact structure:

```markdown
# Security & Data Audit Report — [date]

## Executive Summary
2-3 paragraphs: overall risk posture, top 3 most urgent issues, and whether
this is currently safe to sell to customers who will trust it with their data.

## Data Inventory Table
| Data Type | Classification | Collection Point | Storage Location | Encrypted? | Retention |
|---|---|---|---|---|---|

## Findings

For each finding:

### [SEVERITY] Short title
- **Location**: file:line
- **Issue**: what's wrong
- **Impact**: what an attacker/leak could actually do
- **Evidence**: the relevant code/config (redact secrets)
- **Fix**: concrete remediation step

Severity rubric:
- **Critical** — direct path to another customer's data, remote code
  execution, or full account takeover with no auth
- **High** — auth bypass, injection vuln, exposed secrets in a reachable
  place, cross-tenant data leak under specific conditions
- **Medium** — missing rate limiting, verbose error leaking internals,
  weak but not broken crypto, missing MFA
- **Low** — best-practice gaps with limited real-world exploitability
- **Info** — compliance/documentation gaps, no direct security impact

## Legal & Compliance Findings
(from Phase 4A — doc existence, policy-vs-code mismatches, dependency
license flags, DPA/subprocessor list)

## Certifications & Framework Relevance
(from Phase 4B — SOC 2 / ISO 27001 / PCI-DSS / HIPAA / GDPR / CCPA / FedRAMP,
each rated Likely Relevant / Possibly Relevant / Not Applicable with reason)

> This section is a factual mapping based on code and data findings, not
> legal advice. Confirm all compliance and certification decisions with a
> qualified attorney or compliance professional before launch.

## Prioritized Remediation Roadmap
1. Do immediately (before selling to anyone)
2. Do before first paying customer
3. Do before enterprise customers / scale
```

Order findings by severity, Critical first. Be blunt — the point of this
report is to find every reason a security-conscious customer would say no,
before they do.
