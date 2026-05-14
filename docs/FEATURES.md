# Features Documentation

---

# Authentication & Authorization

## Purpose
Secure access control with JWT tokens and granular RBAC.

## Accessible Roles
All users (login required).

## Workflow
1. User enters email/password
2. Backend validates via bcrypt + queries roles/permissions
3. Returns accessToken (24h) + refreshToken (7d cookie)
4. Frontend stores accessToken in memory, attaches to all API calls
5. Token refresh happens automatically on 401 responses

## APIs Used
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Components Used
- `AuthContext` (React Context)
- `useAuth` hook
- `ProtectedRoute` layout wrapper

## Security Considerations
- Refresh token is HTTP-only cookie
- Permissions fetched from DB on every request (not cached in token)
- No plaintext password storage

---

# Dashboard

## Purpose
Central landing page showing announcements, recognitions, tasks, and user stats.

## Accessible Roles
All authenticated users.

## Workflow
1. Fetches announcements (active only)
2. Fetches recognitions (Monthly Achiever + Best Employee)
3. Shows recent tasks
4. Displays user info

## APIs Used
- `GET /api/admin/announcements`
- `GET /api/admin/recognitions`
- `GET /api/tasks/my`

## Components Used
- Announcement cards with images
- Recognition cards with portraits
- Task summary list

## Related Database Tables
- `admin_schema.announcements`
- `admin_schema.recognitions`
- `task_schema.tasks`

---

# CRM Cases

## Purpose
Manage loan application cases from creation to closure.

## Accessible Roles
All roles (with RBAC filtering). Admins see all cases; non-admins see own + assigned.

## Workflow
1. Create case with customer details + documents
2. Auto-generate case number
3. Assign to user
4. Update status through pipeline
5. Add notes and documents
6. Schedule notifications
7. Archive/export when complete

## APIs Used
- `POST /api/crm/cases`
- `GET /api/crm/cases`
- `GET /api/crm/cases/:id`
- `POST /api/crm/cases/:id/assign`
- `POST /api/crm/cases/:id/status`
- `POST /api/crm/cases/:id/documents`
- `POST /api/crm/cases/:id/notes`
- `POST /api/crm/cases/:id/schedule`

## Validation Rules
- Customer name: required, max 255
- Email: valid email format
- Phone: required
- Loan type: from predefined enum
- Loan amount: positive number
- Documents: max 10 files, 10MB each, any file type

## Edge Cases
- Case number collision: handled by DB trigger with retry logic
- Status change without assignment: allowed but tracked
- Document upload failure: partial save not supported (all-or-nothing)

## Related Database Tables
- `crm_schema.cases`
- `crm_schema.case_assignments`
- `crm_schema.case_status_history`
- `crm_schema.documents`
- `crm_schema.case_notes`
- `crm_schema.case_notifications`

---

# Financial Tools — CAM

## Purpose
Credit Assessment Memo data entry per loan case with admin-defined templates.

## Accessible Roles
Users with `finance.cam.create` / `finance.cam.view`.

## Workflow
1. Select case from search dropdown
2. Backend loads CAM template for case's loan type
3. Form renders sections and fields dynamically from template
4. User fills fields (with validation rules enforced)
5. Save creates versioned CAM entry with template snapshot
6. View version history, export to CSV/Excel/PDF

## APIs Used
- `GET /api/finance/cam/template/:loanType`
- `POST /api/finance/cam`
- `GET /api/finance/cam/:caseId`
- `GET /api/finance/export/cam/:caseId`

## Validation Rules
- Mandatory fields: required per template config
- Number/Currency: valid number parsing
- Date: valid date format
- Select: value must be in defined options
- Custom validation rules: min/max values, min/max length, regex patterns

## Edge Cases
- No template for loan type: shows error + admin CTA
- Template changed after entry: old entries use snapshot, not current template
- Version viewing: read-only mode

## Related Database Tables
- `finance_schema.cam_templates`
- `finance_schema.cam_fields`
- `finance_schema.cam_entries`

---

# Financial Tools — Obligation Sheet

## Purpose
Track monthly obligations and calculate available income per case.

## Accessible Roles
Users with `finance.obligation.create` / `finance.obligation.view`.

## Workflow
1. Select case
2. Load active obligation template
3. Add multiple obligation items (rows)
4. Each item follows template fields
5. Enter net income
6. Auto-calculate total obligation and available income
7. Visual donut chart shows ratio
8. Save or export

## APIs Used
- `GET /api/finance/obligation/template`
- `POST /api/finance/obligation`
- `GET /api/finance/obligation/:caseId`
- `GET /api/finance/export/obligation/:caseId`

## Edge Cases
- No active template: error message
- Collapse/expand items for many rows
- Auto-save draft to localStorage

## Related Database Tables
- `finance_schema.obligation_templates`
- `finance_schema.obligation_fields`
- `finance_schema.obligation_sheets`
- `finance_schema.obligation_items`

---

# Financial Tools — Eligibility

## Purpose
Calculate loan eligibility based on income and configured rules.

## Accessible Roles
Users with `finance.eligibility.calculate`.

## Workflow
1. Select case
2. Enter monthly income + requested amount
3. Backend applies eligibility rules for loan type
4. Returns ELIGIBLE/NOT_ELIGIBLE with calculation breakdown

## APIs Used
- `POST /api/finance/eligibility/calculate`
- `GET /api/finance/eligibility/:caseId`

## Related Database Tables
- `finance_schema.eligibility_rules`
- `finance_schema.eligibility_calculations`

---

# Admin — Template Builder

## Purpose
Admins create/manage CAM and Obligation templates with drag-and-drop field configuration.

## Accessible Roles
Users with `finance.template.manage`.

## Workflow
1. Create template with name (and loan type for CAM)
2. Add sections
3. Add fields to sections
4. Configure field type, validation, options
5. Preview template before saving
6. Clone existing templates
7. Toggle active/inactive
8. Delete with confirmation

## Features
- Drag-and-drop section/field reordering (@dnd-kit)
- Smart field key generation from label
- Validation rules UI (min/max, pattern)
- Live preview mode
- Search/filter template list

## Related Database Tables
- `finance_schema.cam_templates` / `cam_fields`
- `finance_schema.obligation_templates` / `obligation_fields`

---

# Admin — Announcements

## Purpose
Publish company announcements with images.

## Accessible Roles
Users with `admin.announcements.*` permissions.

## Workflow
1. Create announcement with title, content, image
2. Image uploaded via multer → `uploads/announcements/`
3. Public image route serves without auth
4. Active announcements shown on dashboard

## Related Database Tables
- `admin_schema.announcements`

---

# Admin — Recognitions

## Purpose
Manage Monthly Achiever and Best Employee recognitions.

## Accessible Roles
Users with `admin.recognitions.*` permissions.

## Workflow
1. Create recognition with type, employee info, month, image
2. Image uploaded → `uploads/recognitions/`
3. Dashboard displays dynamically
4. Empty state with admin CTA

## Related Database Tables
- `admin_schema.recognitions`

---

# Tasks

## Purpose
Hierarchical task management — assign downward to subordinates or raise upward to managers.

## Accessible Roles
All authenticated users.

## Workflow
1. Create task (personal, common, or hierarchical)
2. Hierarchical tasks validated by DB trigger (must be manager/subordinate)
3. Update status: OPEN → IN_PROGRESS → COMPLETED
4. Add comments
5. View in task list or hierarchy view

## APIs Used
- `POST /api/tasks`
- `GET /api/tasks/my`
- `PUT /api/tasks/:id/status`
- `POST /api/tasks/:id/comments`

## Validation Rules
- DOWNWARD: assigned_to must be direct subordinate
- UPWARD: assigned_to must be direct manager
- Enforced by PostgreSQL trigger

## Related Database Tables
- `task_schema.tasks`
- `task_schema.task_comments`

---

# Hierarchy

## Purpose
Visualize and manage reporting structure.

## Accessible Roles
Admin with `admin.hierarchy.manage`.

## Workflow
1. View org chart (CSS flexbox tree)
2. Assign manager to user
3. Remove manager relationship
4. View hierarchy tree

## Related Database Tables
- `auth_schema.user_hierarchy`

---

# Customer Detail Sheets

## Purpose
Upload and parse Excel files containing customer financial details linked to cases.

## Accessible Roles
Users with `crm.case.upload_document`.

## Workflow
1. Upload Excel file to case
2. Data extracted and stored as JSONB
3. View as structured form popup
4. Request changes → approval workflow
5. Approve/reject change requests

## Related Database Tables
- `crm_schema.customer_detail_sheets`
- `crm_schema.customer_detail_template`
- `crm_schema.customer_detail_change_requests`

---

# Notifications

## Purpose
Case-linked scheduled notifications for follow-ups.

## Accessible Roles
All CRM users.

## Workflow
1. Schedule notification for case
2. Assign to user (self or hierarchy member)
3. Mark as read/unread
4. Mark as ongoing/completed
5. Unread count badge

## Related Database Tables
- `crm_schema.case_notifications`

---

# Export System

## Purpose
Export cases, CAM, obligation, eligibility as CSV/Excel/PDF.

## Accessible Roles
Per-module export permissions.

## Workflow
1. Request export
2. If small: sync processing
3. If large: queued via BullMQ
4. Poll for status
5. Download archive when ready

## Components
- `ExportService`: Generation logic
- `ExportWorker`: BullMQ worker
- `QueueService`: Queue management
