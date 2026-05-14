# Performance Guide

## Frontend Optimization

### Current State
- Next.js 14 App Router with Client Components
- Tailwind CSS (JIT compiler, ~10KB gzipped)
- No SSR for protected pages (all client-side)
- Images optimized via Next.js `<Image>` component

### Recommendations

| Priority | Action | Expected Impact |
|----------|--------|-----------------|
| High | Add `React.memo` to table rows | Reduce re-renders on list pages |
| High | Implement virtual scrolling for tables >100 rows | Reduce DOM nodes |
| Medium | Code-split admin pages with `dynamic()` | Reduce initial bundle |
| Medium | Add `loading.tsx` for route segments | Better perceived performance |
| Low | Service Worker for offline support | Resilience |

### Bundle Analysis
```bash
cd frontend
npm run analyze
```

## Backend Optimization

### Database

#### Index Strategy
```sql
-- High-cardinality search fields
CREATE INDEX idx_cases_customer_name ON crm_schema.cases(customer_name);
CREATE INDEX idx_cases_status ON crm_schema.cases(status);

-- Foreign keys (auto-created, but verify)
CREATE INDEX idx_case_assignments_case_id ON crm_schema.case_assignments(case_id);

-- Audit log timestamp range queries
CREATE INDEX idx_audit_logs_created_at ON audit_schema.audit_logs(created_at DESC);

-- Composite index for common filter patterns
CREATE INDEX idx_cases_status_created ON crm_schema.cases(status, created_at DESC);
```

#### Query Optimization
- Use `EXPLAIN ANALYZE` on slow queries
- Avoid `SELECT *` in large tables
- Use `LIMIT/OFFSET` with ordering
- Consider materialized views for reports

### API Response Times

| Endpoint | Current | Target |
|----------|---------|--------|
| GET /api/crm/cases | ~150ms | <100ms |
| GET /api/admin/users | ~80ms | <50ms |
| POST /api/auth/login | ~120ms | <100ms |
| GET /api/finance/cam | ~200ms | <150ms |

## Caching Strategy

### Already Implemented
- Redis for refresh tokens (session management)
- BullMQ for background job queues

### Recommended Additions

#### API Response Cache
```typescript
// Example: Cache user list for 5 minutes
const getUsers = async () => {
  const cacheKey = 'users:list';
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const users = await db.query('SELECT * FROM auth_schema.users');
  await redis.setex(cacheKey, 300, JSON.stringify(users));
  return users;
};
```

#### Permission Cache
Currently queries DB on every request. Cache in Redis:
```typescript
const getPermissions = async (userId: string) => {
  const cacheKey = `permissions:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  const perms = await db.query(/* permission query */);
  await redis.setex(cacheKey, 3600, JSON.stringify(perms));
  return perms;
};
// Invalidate on role/permission changes
```

## Connection Pooling

### Current
Direct connections via `pg` client. No pooling.

### Recommended
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

## Image Optimization

### Current
- Multer `memoryStorage` (10MB limit)
- Served via Express routes
- No compression

### Recommendations
| Priority | Action |
|----------|--------|
| High | Compress images on upload (sharp/libvips) |
| Medium | Generate thumbnails for previews |
| Medium | Move to S3/CloudFront |
| Low | WebP conversion |

## Monitoring Performance

### Winston Logs
Already configured. Add performance metrics:
```typescript
const startTime = Date.now();
await someOperation();
logger.info('Operation completed', { 
  duration: Date.now() - startTime,
  operation: 'getCases' 
});
```

### Slow Query Log
Enable in PostgreSQL:
```sql
ALTER SYSTEM SET log_min_duration_statement = 500; -- Log queries >500ms
```

## Load Testing

### Tool: Artillery
```yaml
# load-test.yml
config:
  target: 'http://localhost:4000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Get cases"
    requests:
      - get:
          url: "/api/crm/cases"
          headers:
            Authorization: "Bearer {{ token }}"
```

```bash
npm install -g artillery
artillery run load-test.yml
```

## Performance Budget

| Metric | Budget |
|--------|--------|
| Initial JS bundle | < 200KB gzipped |
| First Contentful Paint | < 2s |
| Time to Interactive | < 4s |
| API response (p95) | < 200ms |
| Database query (p95) | < 100ms |
