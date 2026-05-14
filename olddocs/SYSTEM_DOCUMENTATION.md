# SourceCorp Platform System Documentation

## 1. Document Scope

This document is based on the code currently present in the repository, not on the older phase-based docs already under `docs/`.

Where a component is incomplete, inconsistent, or not fully verifiable from code, it is called out explicitly as `not found` or `unclear`.

## 2. System Overview

### 2.1 Purpose

SourceCorp Platform is an internal business operations platform for loan-processing teams. It combines:

- User, role, team, and hierarchy administration
- CRM case intake and lifecycle tracking
- Financial analysis workflows for eligibility, obligation, and CAM
- Task and note management
- Internal announcements
- Real-time team chat with file sharing
- Audit logging and export workflows

### 2.2 Primary Users

The codebase suggests these user groups:

- Administrators: manage users, roles, permissions, teams, announcements, hierarchy, audit logs, and templates
- Sales or operations staff: create and manage cases, add notes, upload documents, schedule follow-ups
- Credit or underwriting staff: review case progress, financial analysis, and customer detail changes
- Managers: view subordinate work, assign hierarchy-based tasks, approve certain requests
- General employees: collaborate through chat, notes, tasks, and announcements

### 2.3 Core Features

- Authentication with JWT access and refresh tokens
- Permission-based authorization on nearly all business routes
- Hierarchy-aware access for cases, scheduling, tasks, and chat
- Case management with status history, assignments, documents, notes, and notifications
- Template-driven financial workflows:
  - Eligibility calculation
  - Obligation sheet capture
  - CAM entry creation and versioning
- Customer detail sheet upload and approval-based change requests
- Team and role-based collaboration through chat channels and DMs
- File-backed uploads for CRM documents, announcements, and exports
- Audit and error logging

## 3. High-Level Architecture

### 3.1 Runtime Topology

```text
+------------------+         HTTP / WebSocket          +----------------------+
| Next.js Frontend |  <-------------------------------->  Express Backend     |
| React + Tailwind |                                      | REST API + Socket.IO|
+------------------+                                      +----------+-----------+
        |                                                            |
        |                                                            |
        |                                                            |
        v                                                            v
  Local browser state                                       +-------------------+
  - auth tokens                                              | PostgreSQL        |
  - user profile                                             | Multi-schema DB   |
  - UI routing                                               +-------------------+
                                                                   |
                                                                   v
                                                            +-------------------+
                                                            | Redis             |
                                                            | refresh tokens    |
                                                            | BullMQ queue      |
                                                            +-------------------+
                                                                   |
                                                                   v
                                                            +-------------------+
                                                            | File storage      |
                                                            | uploads/*         |
                                                            +-------------------+
```

### 3.2 Major Technical Components

#### Frontend

- Framework: Next.js 15 App Router
- UI: React 18, Tailwind CSS, Framer Motion
- API access: Axios client with token refresh interceptor
- Real-time: `socket.io-client`
- Packaging: standalone Next.js Docker build

#### Backend

- Runtime: Node.js + Express + TypeScript
- Validation: Zod schemas via validation middleware
- Auth: JWT access/refresh tokens
- Authorization: RBAC middleware backed by database permissions
- Real-time: Socket.IO
- Background work: BullMQ export jobs
- File uploads: Multer in memory, then persisted by services
- Data access: raw SQL through PostgreSQL client, no ORM found

#### Database

- Engine: PostgreSQL
- Design: separate schemas by domain (`auth_schema`, `crm_schema`, `finance_schema`, etc.)
- Change management:
  - base schema in `backend/src/db/schema.sql`
  - many follow-up TypeScript migration scripts under `backend/src/db/`

#### Infra / Edge

- Reverse proxy config exists under `nginx/`
- Dockerfiles exist for frontend and backend
- Compose file exists as `docker-compose.txt`
- Nginx is configured, but not included in the checked-in compose file

### 3.3 Request Flow

```text
Browser
  -> Next.js page / component
  -> frontend service in src/lib/*
  -> Axios client attaches bearer token
  -> Express route
  -> authenticateToken
  -> requirePermission (when configured)
  -> validate(Zod schema)
  -> controller
  -> service
  -> PostgreSQL / Redis / filesystem / queue
  -> JSON response or file download
```

### 3.4 Routing Notes

- `/` serves a maintenance-style landing page, not the main application shell
- `/logkavi` redirects to `/login` and is explicitly routed through Nginx
- The authenticated application lives primarily under protected frontend routes

## 4. Frontend Architecture

### 4.1 Frontend Structure

Key frontend areas:

- `src/app/layout.tsx`: global layout and auth provider
- `src/app/(protected)/...`: authenticated app pages
- `src/components/`: shared UI such as sidebar and header
- `src/context/AuthContext.tsx`: session bootstrap and user state
- `src/lib/*.ts`: API client wrappers per business domain

### 4.2 Frontend Responsibilities

#### Authentication and Session

- Stores access and refresh tokens in browser local storage
- On app load, rehydrates stored user and calls `/api/auth/me`
- Retries failed requests once after refreshing the access token

#### Protected Application Shell

The protected shell exposes these functional areas in the sidebar:

- Dashboard
- Chat
- CRM
- Financial Tools
- Administration
- Productivity

#### Major Pages Found

- Dashboard
- Login
- CRM case list and case detail
- CRM notifications
- Eligibility, obligation, and CAM tools
- Admin users, roles, teams, hierarchy, announcements, audit logs, templates
- Tasks and hierarchy tasks
- Notes
- Chat

### 4.3 Frontend-to-Backend Coupling

The frontend does not use generated API clients or OpenAPI. Instead, it uses handwritten wrappers in:

- `src/lib/auth.ts`
- `src/lib/crm.ts`
- `src/lib/finance.ts`
- `src/lib/tasks.ts`
- `src/lib/notes.ts`
- `src/lib/chat.ts`
- `src/lib/templates.ts`
- `src/lib/hierarchy.ts`

This gives good visibility into expected API shapes, but it also means API drift can happen silently.

## 5. Backend Architecture

### 5.1 Backend Entry Points

- `backend/src/app.ts`
  - configures Express middleware
  - mounts REST routes
  - exposes `/health`
  - applies 404 and error middleware
- `backend/src/index.ts`
  - verifies PostgreSQL access
  - initializes Redis
  - starts HTTP server
  - initializes Socket.IO service
  - loads export worker

### 5.2 Cross-Cutting Middleware

- `auth.middleware.ts`: validates bearer JWT and loads current user
- `rbac.middleware.ts`: checks permissions using user-role-permission joins
- `validate.middleware.ts`: applies Zod request validation
- `error.middleware.ts`: centralized error handling plus logging to `audit_schema.error_logs`

### 5.3 Backend Design Style

- Thin route definitions
- Controllers map HTTP to service methods
- Services hold business logic and SQL orchestration
- Direct SQL queries rather than repository or ORM abstraction
- File uploads handled in controller layer, then persisted by services

## 6. Module and Service Responsibilities

### 6.1 Authentication

Relevant code:

- `backend/src/controllers/auth.controller.ts`
- `backend/src/utils/jwt.ts`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/lib/api.ts`

Responsibilities:

- Login, logout, token refresh, current-user lookup
- Access token and refresh token generation
- Refresh token persistence in Redis
- User role and permission expansion through `/auth/me`

### 6.2 Admin and RBAC

Relevant code:

- `backend/src/routes/admin.routes.ts`
- `backend/src/controllers/users.controller.ts`
- `backend/src/controllers/roles.controller.ts`
- `backend/src/controllers/permissions.controller.ts`
- `backend/src/controllers/teams.controller.ts`

Responsibilities:

- User CRUD
- Role CRUD
- Permission CRUD
- Team CRUD and membership
- User-role assignment
- Role-permission assignment
- Announcement management
- Hierarchy management
- Audit log access

### 6.3 Hierarchy Service

Relevant code:

- `backend/src/services/hierarchy.service.ts`
- `backend/src/routes/users.routes.ts`

Responsibilities:

- Manager-subordinate assignments
- Cycle prevention
- Direct and recursive subordinate lookup
- Full hierarchy tree generation
- Support for hierarchy-sensitive features in CRM, tasks, and chat

### 6.4 CRM Service

Relevant code:

- `backend/src/services/crm.service.ts`
- `backend/src/routes/crm.routes.ts`

Responsibilities:

- Create, list, read, assign, update, and delete cases
- Record case status history
- Manage case documents and downloadable files
- Manage case notes with optional attachments
- Build case timelines from multiple event sources
- Schedule case notifications and completion tracking
- Upload and parse customer detail sheets from Excel
- Manage customer detail change requests and approvals
- Export case archives

### 6.5 Finance Service

Relevant code:

- `backend/src/services/finance.service.ts`
- `backend/src/services/template.service.ts`
- `backend/src/routes/finance.routes.ts`
- `backend/src/routes/template.routes.ts`

Responsibilities:

- Calculate eligibility using stored rules
- Persist calculation snapshots
- Create obligation sheets from active templates
- Create versioned CAM entries from loan-type templates
- Manage finance templates for admin users
- Export finance artifacts as CSV, XLSX, or PDF

### 6.6 Task Service

Relevant code:

- `backend/src/services/task.service.ts`
- `backend/src/routes/tasks.routes.ts`

Responsibilities:

- Personal, common, and hierarchical task creation
- Downward assignment and upward escalation
- Task status lifecycle
- Linked-case references
- Task comments
- Manager visibility into subordinate tasks

### 6.7 Note Service

Relevant code:

- `backend/src/services/note.service.ts`
- `backend/src/routes/notes.routes.ts`

Responsibilities:

- Personal notes
- Case-linked notes
- Visibility checks based on note type and case access

### 6.8 Chat Service and WebSocket Layer

Relevant code:

- `backend/src/services/chat.service.ts`
- `backend/src/services/websocket.service.ts`
- `backend/src/routes/chat.routes.ts`

Responsibilities:

- Channel creation and approval workflow
- Global, role, team, group, and DM channel models
- Channel access evaluation
- Message send, list, and delete
- File/image attachments
- WebSocket connection auth
- Typing indicators and message broadcast

### 6.9 Audit and Error Logging

Relevant code:

- `backend/src/services/audit.service.ts`
- `audit_schema.audit_logs`
- `audit_schema.error_logs`

Responsibilities:

- Write audit records for business actions
- Capture backend error events
- Expose audit log views to admin users

### 6.10 Export and Queueing

Relevant code:

- `backend/src/services/export.service.ts`
- `backend/src/services/queue.service.ts`
- `backend/src/workers/export.worker.ts`

Responsibilities:

- Export finance data to CSV, XLSX, PDF
- Export CRM case archives to ZIP
- Use BullMQ for asynchronous case export jobs
- Track output files under `uploads/exports`

## 7. API Documentation

### 7.1 API Conventions

- Base path: `/api`
- Auth mechanism: `Authorization: Bearer <access-token>`
- Validation: most endpoints use Zod-backed request validation
- Response style: JSON for normal requests, binary/file response for downloads
- Authorization: route-level permission checks are heavily used

### 7.2 Authentication API

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Authenticate user | `{ email, password }` | `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/refresh` | Exchange refresh token for new tokens | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| `POST` | `/api/auth/logout` | Invalidate current refresh token | bearer token | `{ message }` |
| `GET` | `/api/auth/me` | Return current user profile, roles, permissions | bearer token | `{ id, email, firstName, lastName, isActive, roles[], permissions[] }` |

### 7.3 Admin API

#### Users

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/admin/users` | Create user | user fields from validator | created user |
| `GET` | `/api/admin/users` | List users | query filters if supplied | user list |
| `GET` | `/api/admin/users/:id` | Get user | path id | user detail |
| `PATCH` | `/api/admin/users/:id` | Update user | partial user fields | updated user |
| `DELETE` | `/api/admin/users/:id` | Delete user | path id | confirmation |
| `POST` | `/api/admin/users/:userId/roles` | Assign role to user | `{ roleId }` style payload | confirmation or updated mapping |
| `DELETE` | `/api/admin/users/:userId/roles/:roleId` | Remove role from user | path ids | confirmation |

#### Roles and Permissions

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/admin/roles` | Create role | role fields | created role |
| `GET` | `/api/admin/roles` | List roles | none | role list |
| `GET` | `/api/admin/roles/:id` | Get role detail | path id | role with related data |
| `PATCH` | `/api/admin/roles/:id` | Update role | partial role fields | updated role |
| `DELETE` | `/api/admin/roles/:id` | Delete role | path id | confirmation |
| `POST` | `/api/admin/roles/:roleId/permissions` | Assign permission to role | permission payload | confirmation |
| `DELETE` | `/api/admin/roles/:roleId/permissions/:permissionId` | Remove permission from role | path ids | confirmation |
| `POST` | `/api/admin/permissions` | Create permission | permission fields | created permission |
| `GET` | `/api/admin/permissions` | List permissions | none | permission list |
| `GET` | `/api/admin/permissions/:id` | Get permission | path id | permission |
| `PATCH` | `/api/admin/permissions/:id` | Update permission | partial permission fields | updated permission |
| `DELETE` | `/api/admin/permissions/:id` | Delete permission | path id | confirmation |

#### Teams, Announcements, Audit, Hierarchy

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/admin/teams` | Create team | team fields | created team |
| `GET` | `/api/admin/teams` | List teams | none | team list |
| `GET` | `/api/admin/teams/:id` | Get team | path id | team detail |
| `PATCH` | `/api/admin/teams/:id` | Update team | partial team fields | updated team |
| `DELETE` | `/api/admin/teams/:id` | Delete team | path id | confirmation |
| `POST` | `/api/admin/teams/:teamId/members` | Add team member | membership payload | confirmation |
| `DELETE` | `/api/admin/teams/:teamId/members/:userId` | Remove team member | path ids | confirmation |
| `POST` | `/api/admin/announcements` | Create announcement | multipart form, optional image | created announcement |
| `GET` | `/api/admin/announcements` | List announcements | optional filters | announcement list |
| `GET` | `/api/admin/announcements/:id` | Get announcement | path id | announcement detail |
| `PATCH` | `/api/admin/announcements/:id` | Update announcement | multipart form, optional image | updated announcement |
| `DELETE` | `/api/admin/announcements/:id` | Delete announcement | path id | confirmation |
| `GET` | `/api/admin/announcements/:id/image` | Get announcement image | path id | image binary |
| `GET` | `/api/admin/audit-logs` | Read audit/error logs | query filters | audit log list |
| `POST` | `/api/admin/hierarchy/assign` | Assign manager to subordinate | `{ subordinateId, managerId }` | `{ message, hierarchy }` |
| `DELETE` | `/api/admin/hierarchy/remove` | Remove reporting line | request body with subordinate id | `{ message }` |
| `GET` | `/api/admin/hierarchy/tree` | Get full hierarchy tree | none | hierarchy tree |
| `GET` | `/api/admin/customer-detail-template` | Get customer-detail field template | none | template field list |
| `POST` | `/api/admin/customer-detail-template` | Update customer-detail template | `{ fields[] }` | confirmation |

### 7.4 CRM API

#### Cases and Core Workflow

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/crm/cases` | Create case | multipart form: customer fields, loan data, optional `documents[]` | created case |
| `GET` | `/api/crm/cases` | List cases visible to current user | query: status, `view_type`, pagination, month | `{ cases, total, limit, offset }` |
| `GET` | `/api/crm/scheduleable-users` | Get hierarchy-based schedulable users | none | `{ above, below }` |
| `GET` | `/api/crm/cases/:id` | Get case detail | path id | case detail |
| `DELETE` | `/api/crm/cases/:id` | Delete case and related files | path id | confirmation |
| `POST` | `/api/crm/cases/:id/assign` | Assign case | `{ assigned_to }` | confirmation |
| `POST` | `/api/crm/cases/:id/status` | Update case status | `{ new_status, remarks? }` | confirmation or updated status |

#### Documents, Notes, Timeline

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/crm/cases/:id/documents` | Upload case document | multipart form: `file` | document metadata |
| `GET` | `/api/crm/cases/:id/documents` | List case documents | path id | `{ documents[] }` |
| `GET` | `/api/crm/documents/:documentId` | Download document | path id | file binary |
| `POST` | `/api/crm/cases/:id/notes` | Add case note with optional attachment | multipart form: `note`, optional `file` | note metadata |
| `GET` | `/api/crm/cases/:id/notes` | List case notes | path id | `{ notes[] }` |
| `GET` | `/api/crm/cases/:id/timeline` | Get combined case timeline | path id | `{ timeline[] }` |

#### Notifications and Scheduling

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/crm/cases/:id/schedule` | Schedule case notification | multipart form: `scheduled_for`, `scheduled_at`, optional `message`, optional `file` | notification record |
| `GET` | `/api/crm/cases/:id/notifications` | List notifications for a case | path id | `{ notifications[] }` |
| `GET` | `/api/crm/notifications` | List current-user notifications | filters for read/completion/date/pagination | `{ notifications, total }` |
| `GET` | `/api/crm/notifications/unread-count` | Count unread notifications | none | `{ count }` |
| `PATCH` | `/api/crm/notifications/:id/read` | Mark read/unread | `{ is_read }` | confirmation |
| `PATCH` | `/api/crm/notifications/:id/completion` | Mark ongoing/completed | `{ completion_status }` | confirmation |

#### Customer Detail Sheet and Change Requests

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/crm/cases/:id/customer-detail-sheet` | Upload customer detail Excel sheet | multipart form: `file` | parsed sheet/result |
| `GET` | `/api/crm/cases/:id/customer-detail-sheet` | Read stored customer detail sheet | path id | sheet data |
| `POST` | `/api/crm/cases/:id/customer-detail-change-request` | Request modification to customer details | `{ requested_for, requested_changes }` | created request |
| `GET` | `/api/crm/cases/:id/customer-detail-change-requests` | List case-level requests | path id | `{ change_requests[] }` or similar |
| `GET` | `/api/crm/customer-detail-change-requests/pending` | List pending requests for approver | none | `{ change_requests[] }` |
| `GET` | `/api/crm/customer-detail-change-requests/approvers` | Get eligible approvers | none | `{ users[] }` |
| `POST` | `/api/crm/customer-detail-change-requests/:id/approve` | Approve request | optional remarks | updated request/result |
| `POST` | `/api/crm/customer-detail-change-requests/:id/reject` | Reject request | optional remarks | updated request/result |

#### Case Export

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/crm/cases/export` | Start case archive export | `{ caseIds[] }` | expected `{ jobId, status, sync }`; implementation has compile-time drift |
| `GET` | `/api/crm/cases/export/:jobId` | Get export job status | path job id | expected job state/progress; controller linkage currently unclear |
| `GET` | `/api/crm/cases/export/download/:jobId` | Download ZIP archive | path job id | ZIP file |

### 7.5 Finance API

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/finance/eligibility/calculate` | Calculate loan eligibility | `{ case_id, monthly_income, requested_amount, ...optional rule overrides }` | eligibility calculation |
| `GET` | `/api/finance/eligibility/:caseId` | Get latest eligibility result for case | path case id | eligibility calculation |
| `GET` | `/api/finance/obligation/template` | Get active obligation template | none | obligation template |
| `POST` | `/api/finance/obligation` | Create/update obligation sheet | `{ case_id, template_id?, items[], net_income }` | obligation sheet |
| `GET` | `/api/finance/obligation/:caseId` | Get obligation sheet | path case id | obligation sheet |
| `GET` | `/api/finance/cam/template/:loanType` | Get active CAM template for loan type | path loan type | CAM template |
| `POST` | `/api/finance/cam` | Create CAM entry | `{ case_id, template_id? or loan_type, cam_data, user_added_fields? }` | CAM entry |
| `GET` | `/api/finance/cam/:caseId` | Get CAM entry | path case id, optional `version` query | CAM entry |
| `GET` | `/api/finance/export/eligibility/:caseId` | Export eligibility | query `format=csv|xlsx|pdf` | file binary |
| `GET` | `/api/finance/export/obligation/:caseId` | Export obligation sheet | query `format=csv|xlsx|pdf` | file binary |
| `GET` | `/api/finance/export/cam/:caseId` | Export CAM | query `format=csv|xlsx|pdf` | file binary |

### 7.6 Finance Template Management API

All routes below require `finance.template.manage`.

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/finance/templates/cam` | Create CAM template | template name, loan type, sections, fields | created template |
| `GET` | `/api/finance/templates/cam` | List CAM templates | none | template list |
| `GET` | `/api/finance/templates/cam/:id` | Get CAM template | path id | template detail |
| `GET` | `/api/finance/templates/cam/loan-type/:loanType` | Get CAM template by loan type | path loan type | template detail |
| `PUT` | `/api/finance/templates/cam/:id` | Update CAM template | partial template update | updated template |
| `POST` | `/api/finance/templates/obligation` | Create obligation template | template name, sections, fields | created template |
| `GET` | `/api/finance/templates/obligation` | List obligation templates | none | template list |
| `GET` | `/api/finance/templates/obligation/:id?` | Get obligation template | optional id | template detail |
| `PUT` | `/api/finance/templates/obligation/:id` | Update obligation template | partial template update | updated template |

### 7.7 User Hierarchy API

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/users/me/manager` | Get direct manager | none | user or 404 |
| `GET` | `/api/users/me/subordinates` | Get direct subordinates | none | user list |
| `GET` | `/api/users/me/subordinates/all` | Get recursive subordinate tree flattened/listed | none | user list |

### 7.8 Tasks API

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `GET` | `/api/tasks/my` | Get current user's tasks | optional status/priority/type filters | task list |
| `GET` | `/api/tasks/assigned-to-me` | Legacy task view | optional status filter | task list |
| `GET` | `/api/tasks/assigned-by-me` | Legacy assigned-by view | optional status filter | task list |
| `GET` | `/api/tasks/subordinates` | Get subordinate tasks | optional status filter | task list |
| `POST` | `/api/tasks` | Create task | `{ title, description?, assignedTo, taskType, direction?, priority?, linkedCaseId?, dueDate? }` | created task |
| `PUT` | `/api/tasks/:id/status` | Update task status | `{ status }` | updated task |
| `POST` | `/api/tasks/:id/comments` | Add comment | `{ comment }` | created comment |
| `GET` | `/api/tasks/:id/comments` | List comments | path id | comment list |
| `GET` | `/api/tasks/:id` | Get task detail | path id | task |
| `DELETE` | `/api/tasks/:id` | Delete task | path id | confirmation |

### 7.9 Notes API

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/notes` | Create note | `{ content, linkedCaseId?, visibility? }` | created note |
| `GET` | `/api/notes/my` | Get current user's notes | none | note list |
| `GET` | `/api/notes/case/:caseId` | Get notes for case | path case id | note list |
| `GET` | `/api/notes/:id` | Get note detail | path id | note |
| `DELETE` | `/api/notes/:id` | Delete note | path id | confirmation |

### 7.10 Chat API

#### Channels and Requests

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/chat/channels` | Create channel directly | `{ name?, type, other_user_id?, target_role_id?, target_team_id?, requested_members? }` | channel |
| `POST` | `/api/chat/channels/request` | Request new channel | `{ channel_name, channel_type, target_role_id?, target_team_id?, requested_members? }` | request record |
| `POST` | `/api/chat/channels/request/:id/approve` | Approve request | `{ review_notes? }` | `{ channel, message }` |
| `POST` | `/api/chat/channels/request/:id/reject` | Reject request | `{ review_notes }` | `{ message }` |
| `GET` | `/api/chat/channels/requests` | List requests | query filters | request list |
| `POST` | `/api/chat/dm/start` | Start or reuse DM channel | `{ other_user_id }` | DM channel |
| `GET` | `/api/chat/channels` | List accessible channels | none | channel list |
| `GET` | `/api/chat/channels/:id` | Get channel detail | path id | channel |
| `PATCH` | `/api/chat/channels/:id/rename` | Rename channel | `{ name }` | updated channel |
| `GET` | `/api/chat/users` | Get users available for DM | none | user list |

#### Messages and Files

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |
| `POST` | `/api/chat/messages` | Send text or metadata-backed message | `{ channel_id, content, message_type? }` | message |
| `GET` | `/api/chat/messages/:channelId` | List channel messages | query `limit`, `offset` | message list |
| `DELETE` | `/api/chat/messages/:id` | Delete message | path id | confirmation |
| `POST` | `/api/chat/files/upload` | Upload single attachment | multipart form: `file`, `channel_id`, optional `content` | `{ message, attachment }` |
| `POST` | `/api/chat/files/upload-multiple` | Upload multiple attachments | multipart form: `files[]`, `channel_id`, optional `content` | `{ message, attachments[] }` |
| `GET` | `/api/chat/files/:fileId` | Download attachment | path id | file binary |

### 7.11 WebSocket Events

Implemented via Socket.IO. Event-level protocol is only partially documented in code. Verified event names include:

- `join_channel`
- `leave_channel`
- typing indicator events
- server-side message broadcast events

A full event contract document was `not found`.

## 8. Database Schema and Relationships

### 8.1 Data Model Overview

```text
auth_schema.users
  -> auth_schema.user_roles -> auth_schema.roles -> auth_schema.role_permissions -> auth_schema.permissions
  -> auth_schema.team_members -> auth_schema.teams
  -> auth_schema.user_hierarchy (manager/subordinate)

crm_schema.cases
  -> crm_schema.case_assignments
  -> crm_schema.case_status_history
  -> crm_schema.documents
  -> crm_schema.case_notes
  -> crm_schema.case_notifications
  -> crm_schema.customer_detail_sheets
  -> crm_schema.customer_detail_change_requests
  -> finance_schema.eligibility_calculations
  -> finance_schema.obligation_sheets
  -> finance_schema.cam_entries
  -> task_schema.tasks
  -> note_schema.notes

chat_schema.channels
  -> chat_schema.channel_members
  -> chat_schema.messages
  -> chat_schema.attachments
  -> chat_schema.channel_creation_requests
```

### 8.2 Schema-by-Schema Breakdown

#### `auth_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `users` | core user accounts | linked to roles, teams, hierarchy, tasks, notes, cases, messages |
| `roles` | RBAC roles | linked to `permissions` through `role_permissions` |
| `permissions` | granular action permissions | linked to `roles` |
| `role_permissions` | role-permission mapping | joins roles to permissions |
| `user_roles` | user-role mapping | joins users to roles |
| `teams` | organizational teams | linked via `team_members` and team chat channels |
| `team_members` | team-user membership | joins teams to users |
| `user_hierarchy` | manager-subordinate relationships | supports tasks, CRM scheduling, approvals, chat access |

#### `admin_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `announcements` | global announcements with optional image and category | read in dashboard and announcement views |

#### `audit_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `audit_logs` | business action audit trail | references actor and resource metadata |
| `error_logs` | backend error capture | used by centralized error middleware |

#### `crm_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `cases` | primary CRM entity | referenced by finance, tasks, notes, notifications |
| `case_assignments` | case assignment history | links case, assigner, assignee |
| `case_status_history` | case status transitions | links case and actor |
| `documents` | uploaded case documents | linked to cases and uploaders |
| `case_notes` | notes against cases | linked to cases, creators, optional documents |
| `case_notifications` | scheduled follow-up notifications | linked to case, scheduler, assignee, optional document/change request |
| `customer_detail_sheets` | parsed customer detail sheet data | one case can have stored sheet data |
| `customer_detail_template` | admin-managed display/config template | drives visibility/order of customer-detail fields |
| `customer_detail_change_requests` | approval-based modifications to customer-detail data | linked to cases, requesters, approvers, notifications |

#### `finance_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `eligibility_rules` | stored rule configuration | referenced when calculating eligibility |
| `eligibility_calculations` | saved eligibility outcomes | linked to cases, stores rule snapshot |
| `cam_templates` | CAM template headers | linked to `cam_fields` |
| `cam_fields` | CAM template fields | belong to CAM template |
| `cam_entries` | saved CAM submissions | linked to cases, stores template snapshot and version |
| `obligation_templates` | obligation template headers | linked to `obligation_fields` |
| `obligation_fields` | obligation template field definitions | belong to obligation template |
| `obligation_sheets` | saved obligation sheets | linked to cases, stores template snapshot |
| `obligation_items` | repeatable line items within obligation sheet | belong to obligation sheet |

#### `task_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `tasks` | personal/common/hierarchical tasks | linked to assigner, assignee, optional case |
| `task_comments` | comments on tasks | linked to task and creator |

#### `note_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `notes` | private or case-linked notes | linked to creator and optional case |

#### `chat_schema`

| Table | Purpose | Key Relationships |
| --- | --- | --- |
| `channels` | chat channels and DMs | linked to team/role context depending on type |
| `channel_members` | explicit channel membership | joins channels to users |
| `messages` | chat messages | linked to channel and sender |
| `attachments` | file attachments for messages | linked to messages |
| `channel_creation_requests` | approval workflow for channel creation | linked to requester, reviewer, optional role/team |

### 8.3 Relationship Patterns

Important patterns used repeatedly:

- Many business entities reference `auth_schema.users` for creator, assignee, uploader, approver, or reviewer
- CRM `cases` act as the hub for multiple downstream workflows
- Finance records store snapshot JSON so historical calculations/forms remain stable even if templates change later
- Hierarchy relationships are reused across CRM scheduling, task direction rules, and chat approval logic

### 8.4 Database Behaviors

The schema includes database-side logic such as:

- `updated_at` triggers
- case number generation
- hierarchy cycle protection
- task assignment validation

No ORM-managed migration history table or external migration framework was found; migration behavior is mostly script-driven.

## 9. Setup Instructions

### 9.1 Prerequisites

- Node.js 20+ recommended
- npm
- PostgreSQL
- Redis
- Docker and Docker Compose if using containers

### 9.2 Environment Variables

The runtime config in `backend/src/config/env.ts` expects:

| Variable | Purpose | Default in code |
| --- | --- | --- |
| `NODE_ENV` | runtime mode | `development` |
| `PORT` | backend port | `4000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | PostgreSQL database | `sourcecorp` |
| `DB_USER` | PostgreSQL user | `sourcecorp_user` |
| `DB_PASSWORD` | PostgreSQL password | empty string |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | access token secret | `dev_secret` |
| `JWT_REFRESH_SECRET` | refresh token secret | `dev_refresh_secret` |
| `JWT_EXPIRES_IN` | access token TTL | `24h` |
| `JWT_REFRESH_EXPIRES_IN` | refresh token TTL | `7d` |
| `CORS_ORIGIN` | frontend origin | `http://localhost:3000` |
| `NEXT_PUBLIC_API_URL` | frontend API base URL | `http://localhost:4000/api` in compose |

`.env.example` was `not found`.

### 9.3 Local Development Without Docker

#### Backend

1. Install dependencies in `backend/`
2. Provision PostgreSQL and Redis
3. Set the backend environment variables
4. Run the base schema migration:

```bash
cd backend
npm install
npm run migrate
```

5. Run any required follow-up migrations from `package.json` as needed for your environment
6. Start backend dev server:

```bash
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend defaults to `http://localhost:3000`.

### 9.4 Docker-Based Setup

This repo does not use the standard compose filename. The checked-in file is `docker-compose.txt`.

Bring the stack up with:

```bash
docker compose -f docker-compose.txt up -d --build
```

Then run database migration inside the backend container:

```bash
docker compose -f docker-compose.txt exec backend npm run migrate
```

Notes:

- The helper script `scripts/start.sh` still assumes `docker-compose up -d`
- The compose file includes PostgreSQL, Redis, backend, and frontend
- Nginx is not included in the compose file even though config files exist under `nginx/`

### 9.5 Admin Bootstrap

Bootstrap scripts exist:

- `scripts/setup-admin.sh`
- `scripts/setup-admin.ps1`

These scripts:

- prompt for admin credentials
- create an admin user
- create or reuse an `Admin` role
- seed a set of admin/task permissions

Be aware that some later migrations appear to use different role naming conventions such as `admin` or `super_admin`, so bootstrap behavior should be validated in each environment.

## 10. Deployment Notes

### 10.1 Container Images

- `backend/Dockerfile`: installs dependencies, builds TypeScript, runs `npm start`
- `frontend/Dockerfile`: multi-stage Next.js standalone build

### 10.2 Reverse Proxy

Nginx config indicates intended edge routing:

- `/api/` -> backend
- `/socket.io` -> backend
- `/health` -> backend
- `/logkavi` -> frontend
- `/` -> frontend

### 10.3 File Storage

Operational file directories inferred from code:

- `uploads/announcements`
- `uploads/documents`
- `uploads/exports`

Persistent object storage integration such as S3 was `not found`.

### 10.4 Deployment Gaps

The following deployment artifacts were `not found`:

- Kubernetes manifests
- Terraform or infrastructure-as-code definitions
- CI/CD pipeline definition specific to deployment
- central secrets template

## 11. Key Design Decisions and Patterns

### 11.1 Domain-Separated PostgreSQL Schemas

The database is intentionally partitioned by business domain rather than kept in a single flat schema. This improves logical separation and makes the system easier to reason about:

- auth
- admin
- audit
- CRM
- finance
- tasks
- notes
- chat

### 11.2 Database-Centric RBAC

Permissions are stored as first-class records and checked on each request. This allows flexible role composition without hardcoding access rules into the frontend.

### 11.3 Hierarchy as a Shared Business Primitive

Manager/subordinate relationships are not only administrative metadata. They influence:

- case visibility
- who can schedule work for whom
- who can assign or raise tasks
- who can approve channel or customer-detail actions

### 11.4 Template-Driven Financial Data

CAM and obligation workflows are driven by database templates and field definitions. This reduces the need for code changes when business forms evolve.

### 11.5 Snapshot Persistence

Eligibility rules, CAM templates, and obligation templates are copied into saved records as snapshots. This is a strong design choice for auditability and historical consistency.

### 11.6 Hybrid Sync + Async Processing

Most CRUD flows are synchronous REST calls, while large case exports can move to BullMQ-backed background processing.

### 11.7 REST + WebSocket Collaboration Model

Durable state changes remain in REST endpoints, while chat presence and real-time message delivery use Socket.IO.

### 11.8 File Metadata in DB, Content on Filesystem

Uploads are tracked in PostgreSQL while binary content is stored under local filesystem paths. This is simple to operate locally, but less portable for horizontal scaling.

## 12. Assumptions, Gaps, and Unclear Areas

### 12.1 Documentation Drift

Existing files such as `README.md`, `docs/ARCHITECTURE.md`, and `docs/API.md` appear to describe an earlier platform scope. The current codebase is materially broader.

### 12.2 Compose / Nginx Mismatch

- Nginx config is present
- Docker compose file does not start Nginx
- helper scripts assume a standard `docker-compose` filename

This suggests deployment documentation is incomplete or lagging behind implementation.

### 12.3 TypeScript Health

The repository includes `backend/tsc-errors.txt`, and `backend/package.json` uses:

```json
"build": "tsc || true && cp -r src/assets dist/ 2>/dev/null || true"
```

This means backend builds may continue even when TypeScript reports errors. Current logged issues include:

- CRM controller typing mismatches around notes/documents
- route/controller drift for case export endpoints
- chat service calls to a non-existent audit method name
- JWT typing issues

### 12.4 Testing

No application-owned test suite was found in the repository outside dependency files under `node_modules`.

### 12.5 Customer Detail Sheet Parsing

Customer detail sheet handling is implemented, but it depends on fixed Excel parsing logic in service code rather than a separately documented import contract. A user-facing data dictionary for this import was `not found`.

### 12.6 API Standardization

Response envelopes are not fully uniform across modules. Some endpoints return raw entities, some return lists, and others return `{ message }` or custom wrapper objects.

## 13. Suggested Improvements

### 13.1 Documentation Improvements

- Add a maintained `.env.example`
- Replace or update the older phase-based docs
- Add a dedicated WebSocket event contract document
- Add a customer-detail-sheet import specification
- Add an architecture decision record for hierarchy-driven authorization

### 13.2 Engineering Improvements

- Fix current backend TypeScript errors and remove `tsc || true`
- Add integration tests for auth, CRM, finance, and chat
- Add OpenAPI or equivalent machine-readable API documentation
- Standardize JSON response envelopes
- Rename `docker-compose.txt` to a standard compose filename or update scripts
- Decide on one canonical admin role naming convention
- Consider external object storage if multi-instance deployment is required

## 14. Summary

SourceCorp Platform is a multi-module internal operations system centered on CRM case management and extended by finance workflows, hierarchy-aware collaboration, and admin controls. The codebase shows a pragmatic architecture with clear domain boundaries and several solid design decisions, especially around RBAC, hierarchy reuse, and template snapshots.

The main risks are not architectural absence, but operational drift:

- older docs no longer match the code
- deployment assets are partially out of sync
- backend TypeScript currently tolerates compile errors
- automated tests are `not found`

For a production handoff, the highest-value next step would be to align runtime, docs, and type health so the implementation and operational story become equally trustworthy.
