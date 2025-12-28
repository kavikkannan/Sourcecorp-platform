# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Browser                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/HTTPS
                      │ Port 80/443
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                      │
│  - Routes /api/* to backend                                  │
│  - Routes /* to frontend                                     │
│  - SSL termination (production)                              │
│  - Static file serving                                       │
└─────────┬─────────────────────────────────┬─────────────────┘
          │                                 │
          │ Internal Network                │
          │                                 │
    ┌─────▼─────────┐             ┌────────▼────────┐
    │   Frontend    │             │    Backend      │
    │   Next.js     │             │    Express      │
    │   Port 3000   │             │    Port 4000    │
    │               │             │                 │
    │ - React UI    │             │ - REST API      │
    │ - SSR/SSG     │             │ - Auth Logic    │
    │ - Route Guards│             │ - RBAC          │
    └───────────────┘             │ - Validation    │
                                  │ - Business Logic│
                                  └────┬───────┬────┘
                                       │       │
                         ┌─────────────┘       └──────────────┐
                         │                                     │
                    ┌────▼─────────┐                   ┌──────▼──────┐
                    │  PostgreSQL  │                   │    Redis    │
                    │   Port 5432  │                   │  Port 6379  │
                    │   (internal) │                   │  (internal) │
                    │              │                   │             │
                    │ - User data  │                   │ - Sessions  │
                    │ - RBAC data  │                   │ - Tokens    │
                    │ - Audit logs │                   │ - Cache     │
                    └──────────────┘                   └─────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **HTTP Client**: Axios
- **Validation**: Zod

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Database Client**: node-postgres (pg)
- **Cache Client**: redis
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Validation**: Zod
- **Logging**: Winston

### Infrastructure
- **Container Runtime**: Docker
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

## Data Flow

### Authentication Flow

```
1. User submits credentials → Frontend
2. Frontend → POST /api/auth/login → Backend
3. Backend validates credentials → PostgreSQL
4. Backend generates JWT tokens
5. Backend stores refresh token → Redis
6. Backend logs action → Audit table
7. Backend returns tokens ← Frontend
8. Frontend stores tokens in localStorage
9. Frontend redirects to dashboard
```

### Protected Request Flow

```
1. User action → Frontend
2. Frontend adds Authorization header (JWT)
3. Frontend → API request → Backend
4. Backend: authenticateToken middleware
   - Verifies JWT signature
   - Checks user exists and is active
5. Backend: requirePermission middleware
   - Queries user permissions from DB
   - Checks required permission
6. Backend: Controller logic
   - Business logic execution
   - Database operations
7. Backend: Audit logging (if write operation)
8. Backend → Response → Frontend
9. Frontend updates UI
```

### Token Refresh Flow

```
1. Access token expires (15 min)
2. Frontend receives 401 error
3. Frontend → POST /api/auth/refresh with refresh token
4. Backend verifies refresh token
5. Backend checks token in Redis
6. Backend generates new token pair
7. Backend updates Redis
8. Backend → New tokens → Frontend
9. Frontend retries original request
```

## Database Schema

### auth_schema

**users**
- id (UUID, PK)
- email (unique)
- password_hash
- first_name
- last_name
- is_active
- created_at
- updated_at

**roles**
- id (UUID, PK)
- name (unique)
- description
- created_at
- updated_at

**permissions**
- id (UUID, PK)
- name (unique)
- description
- created_at
- updated_at

**role_permissions** (junction table)
- id (UUID, PK)
- role_id (FK → roles)
- permission_id (FK → permissions)
- created_at

**user_roles** (junction table)
- id (UUID, PK)
- user_id (FK → users)
- role_id (FK → roles)
- created_at

**teams**
- id (UUID, PK)
- name
- description
- created_at
- updated_at

**team_members** (junction table)
- id (UUID, PK)
- team_id (FK → teams)
- user_id (FK → users)
- created_at

### admin_schema

**announcements**
- id (UUID, PK)
- title
- content
- author_id (FK → users)
- is_active
- created_at
- updated_at

### audit_schema

**audit_logs**
- id (UUID, PK)
- user_id (FK → users, nullable)
- action
- resource_type
- resource_id (nullable)
- details (JSONB)
- ip_address
- user_agent
- created_at

## Security Architecture

### Authentication
- JWT-based stateless authentication
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry, stored in Redis
- Secure password hashing with bcrypt (10 rounds)

### Authorization
- Role-Based Access Control (RBAC)
- Permission checks at API level
- Frontend checks for UX only (not trusted)
- Permissions: `resource.action` format

### Network Security
- PostgreSQL not exposed externally
- Redis not exposed externally
- All services on internal Docker network
- Only Nginx exposed on port 80

### Data Security
- Passwords never stored in plain text
- JWT secrets stored in environment variables
- Database credentials in environment variables
- Audit trail for all write operations

### API Security
- CORS configuration
- Helmet.js security headers
- Request validation with Zod
- Rate limiting (to be implemented in Phase 2)

## Scalability Considerations

### Current Architecture (Phase 1)
- Single instance of each service
- Suitable for 100-500 concurrent users
- Vertical scaling by increasing Docker resources

### Future Scaling (Phase 2+)
- Multiple backend instances behind load balancer
- Redis cluster for session management
- PostgreSQL read replicas
- CDN for static assets
- Horizontal pod autoscaling (Kubernetes)

## Monitoring & Observability

### Logging
- Winston structured logging in backend
- All API requests logged
- Error stack traces captured
- Audit logs in database

### Health Checks
- `/health` endpoint on backend
- Docker health checks on all services
- Service dependency checks

### Metrics (to be added)
- Request latency
- Error rates
- Active users
- Database connection pool
- Redis cache hit rate

## Deployment

### Development
```bash
docker-compose up -d
```

### Production
- Use environment-specific `.env` files
- Enable HTTPS in nginx
- Configure external database (RDS, Cloud SQL)
- Configure external Redis (ElastiCache, Cloud Memorystore)
- Set up CI/CD pipeline
- Configure monitoring and alerting

## API Design Principles

1. **RESTful**: Standard HTTP methods (GET, POST, PATCH, DELETE)
2. **Consistent**: Predictable URL patterns
3. **Secure**: Authentication and authorization on all protected routes
4. **Validated**: Request validation with Zod schemas
5. **Documented**: Clear error messages and status codes
6. **Audited**: All write operations generate audit logs

## Code Organization

### Backend Structure
```
backend/
├── src/
│   ├── config/         # Environment and configuration
│   ├── db/             # Database connection and migrations
│   ├── middleware/     # Auth, RBAC, validation, error handling
│   ├── controllers/    # Request handlers
│   ├── routes/         # API route definitions
│   ├── services/       # Business logic
│   ├── validators/     # Zod schemas
│   ├── types/          # TypeScript types
│   ├── utils/          # Helper functions
│   ├── app.ts          # Express app setup
│   └── index.ts        # Entry point
```

### Frontend Structure
```
frontend/
├── src/
│   ├── app/            # Next.js App Router pages
│   ├── components/     # Reusable UI components
│   ├── contexts/       # React contexts (Auth)
│   ├── lib/            # Utilities and API client
│   └── styles/         # Global styles
```

## Future Enhancements

Phase 2 and beyond may include:
- WebSocket support for real-time features
- File upload and storage
- Advanced search and filtering
- Bulk operations
- Export functionality (CSV, PDF)
- Email notifications
- Two-factor authentication
- API rate limiting
- GraphQL API option
- Mobile app (React Native)

