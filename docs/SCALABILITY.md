# Scalability Guide

## Current Architecture

The platform is designed as a monolithic application with clear separation between frontend (Next.js), backend (Express), and data layer (PostgreSQL + Redis).

## Horizontal Scaling

### Docker Compose Scaling
```bash
# Scale backend containers
docker-compose up --scale backend=3

# Requires:
# 1. Load balancer in front (nginx)
# 2. Sticky sessions OR shared Redis for auth
# 3. Read replicas for PostgreSQL (future)
```

### Stateless Backend

The Express backend is **stateless**:
- No in-memory sessions (uses JWT + Redis refresh tokens)
- No file storage (uses in-memory uploads, but should use S3)
- No local caching (all cache goes to Redis)

**Scale by**: Adding more backend containers behind nginx.

## Database Scaling

### Current
- Single PostgreSQL instance
- All schemas on one database
- ~50 tables total

### Strategies

| Strategy | When | Implementation |
|----------|------|----------------|
| **Read Replicas** | Read-heavy workloads | Route reads to replicas, writes to primary |
| **Connection Pooling** | >100 concurrent connections | PgBouncer in transaction mode |
| **Partitioning** | Audit logs grow >100M rows | Partition `audit_logs` by month |
| **Archiving** | Old data rarely accessed | Archive audit logs >1 year old |
| **Schema Separation** | Regulatory requirements | Separate DBs per schema |

## Caching Strategy

### Current Cache Usage
| Layer | Technology | Use Case |
|-------|------------|----------|
| Refresh Tokens | Redis | Session management |
| BullMQ Jobs | Redis | Background tasks |

### Recommended Additions
| Layer | Technology | Use Case |
|-------|------------|----------|
| API Response | Redis | GET /api/admin/users (5min TTL) |
| Permission Resolution | Redis | User permission cache (invalidated on role change) |
| Session Store | Redis | In-memory user sessions |

```typescript
// Example: Permission cache with invalidation
const getUserPermissions = async (userId: string) => {
  const cacheKey = `permissions:${userId}`;
  let permissions = await redis.get(cacheKey);
  if (!permissions) {
    permissions = await db.query(/* fetch permissions */);
    await redis.setex(cacheKey, 3600, JSON.stringify(permissions));
  }
  return JSON.parse(permissions);
};
```

## CDN & Asset Delivery

### Current
- Static assets served by Next.js
- Images served from backend (Multer uploads)

### Recommendations
| Priority | Action | Impact |
|----------|--------|--------|
| High | Move uploads to S3/MinIO | Reduce backend load, faster delivery |
| Medium | Add CloudFront/Cloudflare CDN | Reduce latency globally |
| Low | Next.js static export for marketing pages | Reduce server load |

## Queue Workers

### Current: BullMQ on Redis
```typescript
// Worker example
const taskQueue = new Queue('tasks', { connection: redis });
const worker = new Worker('tasks', async (job) => {
  await processTask(job.data);
}, { concurrency: 5 });
```

### Scaling Workers
- Run workers in separate containers
- Scale workers independently from API servers
- Use `concurrency` setting to control parallelism per worker

## API Rate Limiting

Currently **not implemented**. Recommended:
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);
```

## Microservices Consideration

**Current**: Monolith
**Future**: Consider splitting when:
- Team size > 8 developers
- One module needs independent scaling (e.g., audit logging)
- Different release cycles needed per module

| Candidate Service | Reason |
|-------------------|--------|
| Audit Service | High write volume, separate retention |
| Notification Service | Independent scaling, multiple channels |
| Report Generation | CPU-intensive, background processing |

## Performance Targets

| Metric | Target | Current Estimate |
|--------|--------|------------------|
| API Response (p95) | < 200ms | ~150ms |
| Page Load (FCP) | < 1.5s | ~2s |
| Concurrent Users | 500 | Not tested |
| Database Connections | < 50 | ~10 |
