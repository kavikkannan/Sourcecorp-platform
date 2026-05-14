# LLM Context — SourceCorp Platform

> **Purpose**: This file helps any AI (GPT, Claude, Gemini, Kimi, Copilot) rapidly understand the project without reading the entire source code.

---

## Project Summary

Enterprise internal platform for a financial services company. Manages loan cases (CRM), team hierarchy, task assignments, financial assessments (CAM, Obligation, Eligibility), announcements, and employee recognitions. Built with Next.js + Express + PostgreSQL + Redis.

**Key domain**: Loan origination workflow management with hierarchical team structures.

---

## Architecture at a Glance

```
Next.js 15 (App Router) → Express 5 API → PostgreSQL 16 + Redis 7
                              ↓
                        BullMQ Workers (exports)
```

- **Frontend**: SSR/CSR hybrid, Tailwind, Framer Motion, Sonner toasts, @dnd-kit
- **Backend**: Stateless REST API, JWT auth, RBAC middleware, Zod validation
- **Database**: 6 PostgreSQL schemas, UUID PKs, JSONB for flexible fields, triggers for business rules
- **Queue**: BullMQ on Redis for async exports

---

## Core Modules & Responsibilities

| Module | Backend File | Frontend Path | Responsibility |
|--------|-------------|---------------|----------------|
| Auth | `auth.controller.ts` | `app/login` | JWT login/refresh/logout |
| Users | `users.controller.ts` | `app/admin/users` | CRUD + role assignment |
| Roles/Permissions | `roles.controller.ts`, `permissions.controller.ts` | `app/admin/roles` | RBAC management |
| Teams | `teams.controller.ts` | `app/admin/teams` | Team creation + members |
| Hierarchy | `hierarchy.controller.ts` | `app/admin/hierarchy`, `app/tasks/hierarchy` | Manager-subordinate tree |
| CRM Cases | `crm.controller.ts` | `app/crm/cases`, `app/crm/cases/[id]` | Loan case lifecycle |
| Finance | `finance.controller.ts` | `app/financial-tools/*` | CAM, Obligation, Eligibility |
| Templates | `template.controller.ts` | `app/admin/templates/*` | Admin template builder |
| Tasks | `task.controller.ts` | `app/tasks`, `app/tasks/hierarchy` | Hierarchical task mgmt |
| Notes | `note.controller.ts` | `app/notes` | Personal + case notes |
| Announcements | `announcements.controller.ts` | `app/announcements`, `app/admin/announcements` | Company announcements |
| Recognitions | `recognitions.controller.ts` | `app/admin/recognitions`, `app/dashboard` | Employee awards |
| Audit | `audit.controller.ts` | `app/admin/audit-logs` | Activity logging |
| Export | `export.service.ts`, `export.worker.ts` | — | Async CSV/Excel/PDF generation |

---

## Critical APIs (Most Used)

```
POST /api/auth/login              → JWT tokens
GET  /api/auth/me                 → Current user + permissions
GET  /api/crm/cases               → List cases (RBAC filtered)
POST /api/crm/cases               → Create case
GET  /api/crm/cases/:id           → Case detail
POST /api/finance/cam             → Save CAM entry
POST /api/finance/obligation      → Save obligation sheet
PUT  /api/tasks/:id/status        → Update task status
GET  /api/tasks/my                → My tasks
```

---

## Naming Conventions

### Backend
- Controllers: `PascalCaseController` (e.g., `CRMController`)
- Services: `PascalCaseService` (e.g., `CRMService`)
- Routes: `kebab-case.routes.ts`
- Validators: `camelCaseSchema` (Zod)
- Database schemas: `snake_case_schema`
- Tables: `snake_case`
- API paths: `kebab-case`

### Frontend
- Components: `PascalCase` (e.g., `PageHeader`)
- Pages: `kebab-case/page.tsx` (Next.js convention)
- Services: `camelCaseService` (e.g., `crmService`)
- Hooks: `useCamelCase`
- Types/Interfaces: `PascalCase`

### Permissions
- Format: `resource.action.subaction`
- Examples: `admin.users.create`, `crm.case.view`, `finance.cam.create`

---

## Key Code Patterns

### Backend Controller Pattern
```typescript
static async handler(req: AuthRequest, res: Response) {
  try {
    const data = await Service.method(req.user!.userId, req.body);
    await AuditService.createLog({...});
    res.json(data);
  } catch (error) {
    throw error; // Global error handler catches
  }
}
```

### Backend Service Pattern
```typescript
static async method(id: string, data: any) {
  const result = await query('SQL WITH $params', [values]);
  return result.rows[0];
}
```

### Frontend API Pattern
```typescript
export const service = {
  async method(data: Type): Promise<ReturnType> {
    const response = await api.post('/path', data);
    return response.data;
  }
};
```

### Frontend Page Pattern
```typescript
'use client';
export default function Page() {
  const { hasPermission } = useAuth();
  const [data, setData] = useState([]);
  useEffect(() => { fetchData(); }, []);
  return <div>...</div>;
}
```

---

## Database Relationships

```
User → UserRoles → Role → RolePermissions → Permission
User → UserHierarchy (manager/subordinate)
User → TeamMembers → Team
Case → CaseAssignments → User
Case → Documents | Notes | StatusHistory | Notifications
Case → CAMEntry | ObligationSheet | EligibilityCalculation
CAMTemplate → CAMFields → CAMEntry (via snapshot)
ObligationTemplate → ObligationFields → ObligationSheet
Task → TaskComments
```

---

## Business Constraints

1. **Case numbers are auto-generated**: `PREFIX-YYYYMMDD-USERID-XXXXX`
2. **Hierarchy is strict tree**: No cycles (enforced by DB trigger)
3. **Tasks enforce hierarchy**: DOWNWARD only to direct subordinates, UPWARD only to direct manager
4. **CAM/Obligation use templates**: Admin defines templates → users fill entries per case
5. **Template snapshots preserve history**: Entry stores template state at creation time
6. **RBAC is dynamic**: Permissions fetched from DB on every request
7. **Exports are async**: Large exports queued via BullMQ
8. **Image uploads are public**: Announcement/recognition images served without auth

---

## State Flow

### Case Lifecycle
```
NEW → ASSIGNED → IN_PROGRESS → PENDING_DOCUMENTS → UNDER_REVIEW → APPROVED/REJECTED → CLOSED
```

### Task Lifecycle
```
OPEN → IN_PROGRESS → COMPLETED
```

### Eligibility Flow
```
Case + Monthly Income + Requested Amount → Rule Engine → ELIGIBLE / NOT_ELIGIBLE
```

---

## Reusable Utilities

### Backend
- `query(sql, params)` — PostgreSQL parameterized query wrapper
- `logger` — Winston structured logger
- `getErrorMessage(error)` — Normalized error extraction
- `formatIndianNumber(num)` — Indian number formatting
- `formatIndianCurrency(num)` — Indian currency formatting

### Frontend
- `api` — Axios instance with auth interceptors
- `downloadBlob(blob, filename)` — File download helper
- `useDebounce(value, delay)` — Debounce hook
- `formatNumber.ts` — Number/currency formatting

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Insufficient permissions" on task start | Old JWT missing `task.update.status` | Log out and log back in |
| Template modal too narrow | Default max-w-2xl | Use `size="2xl"` prop on Modal |
| Table generic typing error | `Column<unknown>[]` mismatch | Cast columns `as any` |
| Image 404 | Route not registered before auth | Public image routes before `app.use('/api/admin')` |

---

## File Upload Flow

1. Frontend: `<input type="file">` → FormData
2. Multer: Memory storage → `req.file.buffer`
3. Controller: `fs.writeFileSync('uploads/path/' + filename, buffer)`
4. Response: Return file path
5. Serve: Static route or controller-served

---

## Export Flow

1. Frontend: Request export → API returns jobId
2. Backend: If < threshold, sync processing. If >= threshold, queue BullMQ job
3. Worker: Generates CSV/Excel/PDF → Saves to filesystem
4. Frontend: Polls `/export/:jobId` for status
5. Download: `/export/download/:jobId` serves file
