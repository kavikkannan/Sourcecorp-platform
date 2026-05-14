# API Documentation

## Authentication

### POST /api/auth/login
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "jwt-string",
  "refreshToken": "jwt-string",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "roles": ["Admin"]
  }
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request:** Cookie: `refreshToken`

**Response:**
```json
{
  "accessToken": "new-jwt-string"
}
```

### GET /api/auth/me
Get current authenticated user.

**Headers:** `Authorization: Bearer <token>`

---

## Admin

### Users

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/admin/users` | `admin.users.create` | Create user |
| GET | `/api/admin/users` | `admin.users.read` | List users |
| GET | `/api/admin/users/:id` | `admin.users.read` | Get user |
| PATCH | `/api/admin/users/:id` | `admin.users.update` | Update user |
| DELETE | `/api/admin/users/:id` | `admin.users.delete` | Delete user |
| POST | `/api/admin/users/:userId/roles` | `admin.users.assign_role` | Assign role |
| DELETE | `/api/admin/users/:userId/roles/:roleId` | `admin.users.remove_role` | Remove role |

### Roles

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/admin/roles` | `admin.roles.create` | Create role |
| GET | `/api/admin/roles` | `admin.roles.read` | List roles |
| GET | `/api/admin/roles/:id` | `admin.roles.read` | Get role |
| PATCH | `/api/admin/roles/:id` | `admin.roles.update` | Update role |
| DELETE | `/api/admin/roles/:id` | `admin.roles.delete` | Delete role |
| POST | `/api/admin/roles/:roleId/permissions` | `admin.roles.assign_permission` | Assign permission |
| DELETE | `/api/admin/roles/:roleId/permissions/:permissionId` | `admin.roles.remove_permission` | Remove permission |

### Teams

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/admin/teams` | `admin.teams.create` | Create team |
| GET | `/api/admin/teams` | `admin.teams.read` | List teams |
| GET | `/api/admin/teams/:id` | `admin.teams.read` | Get team |
| PATCH | `/api/admin/teams/:id` | `admin.teams.update` | Update team |
| DELETE | `/api/admin/teams/:id` | `admin.teams.delete` | Delete team |
| POST | `/api/admin/teams/:teamId/members` | `admin.teams.add_member` | Add member |
| DELETE | `/api/admin/teams/:teamId/members/:userId` | `admin.teams.remove_member` | Remove member |

### Announcements

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/admin/announcements` | `admin.announcements.create` | Create (multipart: image) |
| GET | `/api/admin/announcements` | `admin.announcements.read` | List |
| GET | `/api/admin/announcements/:id` | `admin.announcements.read` | Get |
| PATCH | `/api/admin/announcements/:id` | `admin.announcements.update` | Update (multipart) |
| DELETE | `/api/admin/announcements/:id` | `admin.announcements.delete` | Delete |
| GET | `/api/announcements/:id/image` | Public | Get image |

### Recognitions

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/admin/recognitions` | `admin.recognitions.create` | Create (multipart: image) |
| GET | `/api/admin/recognitions` | `admin.recognitions.read` | List |
| GET | `/api/admin/recognitions/:id` | `admin.recognitions.read` | Get |
| PATCH | `/api/admin/recognitions/:id` | `admin.recognitions.update` | Update (multipart) |
| DELETE | `/api/admin/recognitions/:id` | `admin.recognitions.delete` | Delete |
| GET | `/api/recognitions/:id/image` | Public | Get image |

### Hierarchy

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/admin/hierarchy/assign` | `admin.hierarchy.manage` | Assign manager |
| DELETE | `/api/admin/hierarchy/remove` | `admin.hierarchy.manage` | Remove manager |
| GET | `/api/admin/hierarchy/tree` | `admin.hierarchy.manage` | Get full tree |

### Audit Logs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/admin/audit-logs` | `admin.audit.read` | List audit logs |

---

## CRM

### Cases

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/crm/cases` | `crm.case.create` | Create case (multipart: documents) |
| GET | `/api/crm/cases` | `crm.case.view` | List cases (RBAC filtered) |
| GET | `/api/crm/cases/:id` | `crm.case.view` | Get case |
| DELETE | `/api/crm/cases/:id` | `crm.case.delete` | Delete case |
| POST | `/api/crm/cases/:id/assign` | `crm.case.assign` | Assign case |
| POST | `/api/crm/cases/:id/status` | `crm.case.update_status` | Update status |

### Documents

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/crm/cases/:id/documents` | `crm.case.upload_document` | Upload |
| GET | `/api/crm/cases/:id/documents` | `crm.case.view` | List |
| GET | `/api/crm/documents/:documentId` | `crm.case.view` | Download |

### Notes

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/crm/cases/:id/notes` | `crm.case.add_note` | Add note (multipart) |
| GET | `/api/crm/cases/:id/notes` | `crm.case.view` | List notes |

### Notifications

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/crm/cases/:id/schedule` | `crm.case.add_note` | Schedule notification |
| GET | `/api/crm/cases/:id/notifications` | `crm.case.view` | Case notifications |
| GET | `/api/crm/notifications` | `crm.case.view` | My notifications |
| GET | `/api/crm/notifications/unread-count` | `crm.case.view` | Unread count |
| PATCH | `/api/crm/notifications/:id/read` | `crm.case.view` | Mark read/unread |
| PATCH | `/api/crm/notifications/:id/completion` | `crm.case.view` | Mark completed |

### Customer Detail Sheets

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/crm/cases/:id/customer-detail-sheet` | `crm.case.upload_document` | Upload Excel |
| GET | `/api/crm/cases/:id/customer-detail-sheet` | `crm.case.view` | Get sheet |

### Change Requests

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/crm/cases/:id/customer-detail-change-request` | `crm.case.customer_details.request_change` | Request change |
| GET | `/api/crm/cases/:id/customer-detail-change-requests` | `crm.case.view` | List requests |
| GET | `/api/crm/customer-detail-change-requests/pending` | `crm.case.customer_details.modify` | Pending for me |
| GET | `/api/crm/customer-detail-change-requests/approvers` | `crm.case.customer_details.request_change` | Get approvers |
| POST | `/api/crm/customer-detail-change-requests/:id/approve` | `crm.case.customer_details.modify` | Approve |
| POST | `/api/crm/customer-detail-change-requests/:id/reject` | `crm.case.customer_details.modify` | Reject |

### Exports

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/crm/cases/export` | `crm.case.export` | Initiate export |
| GET | `/api/crm/cases/export/:jobId` | `crm.case.export` | Job status |
| GET | `/api/crm/cases/export/download/:jobId` | `crm.case.export` | Download archive |

---

## Finance

### Eligibility

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/finance/eligibility/calculate` | `finance.eligibility.calculate` | Calculate |
| GET | `/api/finance/eligibility/:caseId` | `finance.eligibility.view` | Get result |

### CAM

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/finance/cam/template/:loanType` | `finance.cam.create` | Get template |
| POST | `/api/finance/cam` | `finance.cam.create` | Create entry |
| GET | `/api/finance/cam/:caseId` | `finance.cam.view` | Get entry |

### Obligation

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/finance/obligation/template` | `finance.obligation.create` | Get template |
| POST | `/api/finance/obligation` | `finance.obligation.create` | Create sheet |
| GET | `/api/finance/obligation/:caseId` | `finance.obligation.view` | Get sheet |

### Exports

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/finance/export/eligibility/:caseId` | `finance.export` | Export eligibility |
| GET | `/api/finance/export/obligation/:caseId` | `finance.export` | Export obligation |
| GET | `/api/finance/export/cam/:caseId` | `finance.export` | Export CAM |

---

## Templates (Admin)

### CAM Templates

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/finance/templates/cam` | `finance.template.manage` | Create |
| GET | `/api/finance/templates/cam` | `finance.template.manage` | List |
| GET | `/api/finance/templates/cam/:id` | `finance.template.manage` | Get |
| GET | `/api/finance/templates/cam/loan-type/:loanType` | `finance.template.manage` | By loan type |
| PUT | `/api/finance/templates/cam/:id` | `finance.template.manage` | Update |
| DELETE | `/api/finance/templates/cam/:id` | `finance.template.manage` | Delete |

### Obligation Templates

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/finance/templates/obligation` | `finance.template.manage` | Create |
| GET | `/api/finance/templates/obligation` | `finance.template.manage` | List |
| GET | `/api/finance/templates/obligation/:id` | `finance.template.manage` | Get |
| PUT | `/api/finance/templates/obligation/:id` | `finance.template.manage` | Update |
| DELETE | `/api/finance/templates/obligation/:id` | `finance.template.manage` | Delete |

---

## Tasks

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/tasks/my` | Any authenticated | My tasks |
| GET | `/api/tasks/assigned-to-me` | Any authenticated | Assigned to me |
| GET | `/api/tasks/assigned-by-me` | Any authenticated | Assigned by me |
| GET | `/api/tasks/subordinates` | `task.view.subordinates` | Subordinate tasks |
| POST | `/api/tasks` | Any task permission | Create task |
| PUT | `/api/tasks/:id/status` | `task.update.status` | Update status |
| POST | `/api/tasks/:id/comments` | Any authenticated | Add comment |
| GET | `/api/tasks/:id/comments` | Any authenticated | Get comments |
| GET | `/api/tasks/:id` | Any authenticated | Get task |
| DELETE | `/api/tasks/:id` | Any authenticated | Delete task |

---

## Notes

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/api/notes` | `note.create` | Create note |
| GET | `/api/notes/my` | Any authenticated | My notes |
| GET | `/api/notes/case/:caseId` | `note.view.case` | Case notes |
| GET | `/api/notes/:id` | Any authenticated | Get note |
| DELETE | `/api/notes/:id` | Any authenticated | Delete note |

---

## Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/me/manager` | Required | My manager |
| GET | `/api/users/me/subordinates` | Required | My subordinates |
