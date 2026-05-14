# Security Documentation

## Authentication

### JWT-Based Authentication
- **Access Token**: Short-lived (24h default), stored in memory (frontend)
- **Refresh Token**: Long-lived (7d default), stored in HTTP-only cookie
- **Algorithm**: HS256 with configurable secrets
- **Payload**: `userId`, `email`, `roles[]`, `permissions[]`

### Login Flow
```
Client → POST /api/auth/login {email, password}
  → bcrypt.compare()
  → Query roles + permissions from DB
  → Sign accessToken (24h) + refreshToken (7d)
  → Store refresh mapping in Redis
  → Set refreshToken as HTTP-only cookie
  → Return accessToken + user data
```

### Token Refresh
```
Client → POST /api/auth/refresh (cookie: refreshToken)
  → Verify refreshToken
  → Check Redis for valid mapping
  → Issue new accessToken
```

### Logout
- Deletes refresh token mapping from Redis
- Client clears access token from memory

## Authorization

### RBAC Model
- **Users** → **Roles** → **Permissions**
- Granular permissions: `resource.action.subaction` (e.g., `admin.users.create`)
- 60+ permissions across all modules
- Permissions fetched from DB on every request (no caching in token)

### Permission Middleware
```typescript
requirePermission('crm.case.create')     // Must have exact permission
requireAnyPermission(['task.create.personal', 'task.assign.downward']) // Any of these
```

### Role Hierarchy (Implicit)
- `super_admin` → all permissions
- `admin` → most admin + CRM permissions
- `manager` → task assignment + subordinate view
- `employee` → basic task + note creation

## Input Validation

All API inputs validated via **Zod schemas**:
- Type coercion and casting
- String length limits
- Enum validation
- UUID format validation
- Numeric range validation
- Custom refinements

Example:
```typescript
export const createCaseSchema = z.object({
  body: z.object({
    customer_name: z.string().min(1).max(255),
    customer_email: z.string().email(),
    loan_type: z.enum(['Personal Loan', 'Home Loan', ...]),
    loan_amount: z.number().positive(),
  }),
});
```

## SQL Injection Prevention

- **Parameterized queries only** via `pg` driver
- `query('SELECT * FROM users WHERE id = $1', [userId])`
- No string concatenation in SQL
- Schema-qualified table names (`auth_schema.users`)

## XSS Prevention

- Frontend uses React (auto-escapes output)
- No `dangerouslySetInnerHTML` usage
- File uploads restricted to images via mimetype check
- `helmet()` middleware sets security headers

## CSRF Mitigation

- Refresh token uses HTTP-only cookie
- CORS configured with `credentials: true`
- Origin validation in CORS middleware

## File Upload Security

| Check | Implementation |
|-------|---------------|
| File type | `file.mimetype.startsWith('image/')` |
| File size | 10MB limit |
| Storage | Memory (Multer) — files not persisted to disk |
| Path | Saved to `uploads/announcements/` or `uploads/recognitions/` |

**Production Note**: Memory storage is suitable for small images. For large files or high traffic, migrate to S3/object storage with signed URLs.

## Password Security

- **Hashing**: bcrypt with default salt rounds
- **Storage**: `password_hash` column only
- **Plaintext**: Never stored or logged

## CORS Configuration

```typescript
cors({
  origin: (origin, callback) => {
    const allowed = ['http://localhost:3000', config.cors.origin];
    callback(null, allowed.includes(origin));
  },
  credentials: true,
})
```

**Current Issue**: Development mode allows all origins (`callback(null, true)` fallback). **Fix before production**.

## Audit Logging

Every critical operation logged to `audit_schema.audit_logs`:
- User ID, action, resource type, resource ID
- Details (JSONB)
- IP address, user agent
- Timestamp

Actions logged:
- All CRUD operations
- Logins/logouts
- Status changes
- Assignments
- Permission changes

## Error Handling

- Production: Generic error messages (no stack traces to client)
- Development: Detailed error responses
- All errors logged to `audit_schema.error_logs`
- Winston logger with structured logging

## Secrets Management

| Secret | Source | Risk Level |
|--------|--------|------------|
| JWT_SECRET | `.env` | HIGH — Must be strong random string |
| JWT_REFRESH_SECRET | `.env` | HIGH — Different from JWT_SECRET |
| DB_PASSWORD | `.env` | HIGH — Use strong password |
| Redis (no auth) | `.env` | MEDIUM — Redis accessible within network |

**Current Gap**: No secrets rotation mechanism. No HashiCorp Vault/AWS Secrets Manager integration.

## Docker Security

- Non-root user not configured in Dockerfiles
- No health checks defined
- No resource limits configured

## Identified Security Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| CORS allows all origins in dev fallback | MEDIUM | Remove fallback before production |
| No rate limiting | MEDIUM | Add `express-rate-limit` |
| No HTTPS enforcement | HIGH | Terminate TLS at NGINX |
| File uploads to disk without scanning | MEDIUM | Add ClamAV or cloud scanning |
| No input sanitization on search fields | LOW | Add SQL injection tests |
| JWT secrets may be weak defaults | HIGH | Enforce strong secrets in production |
| No Content Security Policy | MEDIUM | Configure helmet CSP |
| Redis accessible without auth | LOW | Enable Redis AUTH in production |
| No request size limits beyond 10MB | LOW | Add express.json() limits |
| Password policy not enforced | MEDIUM | Add min length, complexity rules |
