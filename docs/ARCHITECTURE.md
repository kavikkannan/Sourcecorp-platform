# Architecture Documentation

## High-Level Architecture

```mermaid
graph TB
    subgraph Client
        Browser[Browser/Chrome]
    end

    subgraph Edge
        NGINX[NGINX Reverse Proxy<br/>SSL Termination<br/>Static File Serving]
    end

    subgraph Application
        Frontend[Next.js 15 Frontend<br/>App Router<br/>Tailwind CSS]
        Backend[Express 5 Backend<br/>TypeScript<br/>REST API]
    end

    subgraph Data
        PostgreSQL[(PostgreSQL 16<br/>6 Schemas<br/>JSONB + Triggers)]
        Redis[(Redis 7<br/>Sessions + Cache + Queue)]
        FileSystem[File System<br/>Uploads / Exports]
    end

    subgraph Workers
        ExportWorker[Export Worker<br/>BullMQ]
    end

    Browser -->|HTTPS 443| NGINX
    NGINX -->|/api/*| Backend
    NGINX -->|/_next/*<br/>/| Frontend
    Backend -->|pg Pool| PostgreSQL
    Backend -->|ioredis| Redis
    Backend -->|BullMQ| ExportWorker
    ExportWorker -->|Read/Write| FileSystem
    Backend -->|Multer| FileSystem
```

## Request Lifecycle

```mermaid
sequenceDiagram
    participant C as Browser Client
    participant N as NGINX
    participant F as Next.js Frontend
    participant B as Express Backend
    participant M as Middleware Chain
    participant R as Route Handler
    participant S as Service Layer
    participant DB as PostgreSQL

    C->>N: HTTPS Request
    N->>F: Static/SSR Page (GET /)
    F-->>C: HTML + Hydrated React
    C->>N: API Call (GET /api/crm/cases)
    N->>B: Proxy to :4000
    B->>M: helmet → cors → cookieParser
    B->>M: express.json() → express.urlencoded()
    B->>M: authenticateToken (JWT verify)
    B->>M: requirePermission (RBAC check)
    B->>M: validate (Zod schema)
    B->>R: Route handler
    R->>S: Service method
    S->>DB: Parameterized query
    DB-->>S: Result rows
    S-->>R: Business object
    R-->>B: JSON response
    B-->>N: HTTP 200 + JSON
    N-->>C: Response
```

## Database Schema Architecture

```mermaid
erDiagram
    auth_schema_users ||--o{ auth_schema_user_roles : has
    auth_schema_roles ||--o{ auth_schema_user_roles : assigned_to
    auth_schema_roles ||--o{ auth_schema_role_permissions : has
    auth_schema_permissions ||--o{ auth_schema_role_permissions : granted_to
    auth_schema_users ||--o{ auth_schema_user_hierarchy : manages
    auth_schema_users ||--o{ auth_schema_user_hierarchy : reports_to
    auth_schema_teams ||--o{ auth_schema_team_members : includes
    auth_schema_users ||--o{ auth_schema_team_members : member_of

    crm_schema_cases ||--o{ crm_schema_case_assignments : assigned
    auth_schema_users ||--o{ crm_schema_case_assignments : assignee
    crm_schema_cases ||--o{ crm_schema_documents : contains
    crm_schema_cases ||--o{ crm_schema_case_notes : has
    crm_schema_cases ||--o{ crm_schema_case_status_history : tracks

    finance_schema_cam_templates ||--o{ finance_schema_cam_fields : defines
    finance_schema_cam_templates ||--o{ finance_schema_cam_entries : used_in
    finance_schema_obligation_templates ||--o{ finance_schema_obligation_fields : defines
    finance_schema_obligation_templates ||--o{ finance_schema_obligation_sheets : used_in
    finance_schema_obligation_sheets ||--o{ finance_schema_obligation_items : contains

    task_schema_tasks ||--o{ task_schema_task_comments : has
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Backend
    participant DB as PostgreSQL
    participant R as Redis

    C->>B: POST /api/auth/login<br/>{email, password}
    B->>DB: SELECT user + roles
    DB-->>B: User + role names
    B->>DB: SELECT permissions for roles
    DB-->>B: Permission list
    B->>B: bcrypt.compare(password)
    B->>B: jwt.sign(accessToken, 24h)
    B->>B: jwt.sign(refreshToken, 7d)
    B->>R: Store refresh token mapping
    B-->>C: {accessToken, refreshToken, user}<br/>Set-Cookie: refreshToken
```

## Service Layer Design

The backend follows a **Controller-Service** pattern:

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Route** | URL mapping + middleware chain | `crm.routes.ts` |
| **Controller** | HTTP handling, request/response | `CRMController.createCase` |
| **Service** | Business logic, database operations | `CRMService.createCase` |
| **Validator** | Input validation (Zod) | `createCaseSchema` |
| **Middleware** | Cross-cutting concerns | `authenticateToken`, `requirePermission` |

## Caching Strategy

| Data | Cache Layer | TTL | Invalidation |
|------|------------|-----|--------------|
| User permissions | Redis | Session lifetime | On role change |
| Export job status | Redis (BullMQ) | Until completion | Job completion |
| Session tokens | Redis | 7 days | Logout |

## State Management

### Frontend
- **Auth state**: React Context (`AuthContext`) with localStorage persistence
- **Server state**: Direct API calls via service functions (no React Query/SWR)
- **Form state**: useState hooks
- **Global UI**: Component-level state

### Backend
- **Stateless**: No server-side sessions (JWT-based)
- **RBAC cache**: Permissions cached in `req.userPermissions` per request

## Scalability Design

- **Horizontal**: NGINX can load-balance multiple backend instances
- **Database**: Read replicas possible; JSONB for flexible schema evolution
- **Exports**: Async processing via BullMQ workers to avoid blocking requests
- **File uploads**: Memory storage (Multer) — for production, switch to S3/streaming
- **Frontend**: Static export capability via Next.js

## Multi-Service Interaction

```mermaid
graph LR
    CRM[CRM Service] -->|Case ID| Finance[Finance Service]
    CRM -->|User ID| Hierarchy[Hierarchy Service]
    CRM -->|Case IDs| Export[Export Service]
    Task[Task Service] -->|User ID| Hierarchy
    Auth[Auth Middleware] -->|User + Perms| All[All Services]
    Audit[Audit Service] -->|Logs| PostgreSQL
```

## Security Layers

```mermaid
graph TD
    A[Client Request] --> B[HTTPS/TLS]
    B --> C[NGINX]
    C --> D[Helmet Headers]
    D --> E[CORS Policy]
    E --> F[JWT Authentication]
    F --> G[RBAC Permission Check]
    G --> H[Zod Input Validation]
    H --> I[Parameterized SQL]
    I --> J[Audit Logging]
```
