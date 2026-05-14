# Frontend Modules Documentation

> **Scope:** This document covers the frontend implementation of the CRM, Admin, and Hierarchy modules in the SourceCorp Platform. It describes the Next.js App Router pages, components, data flows, API integrations, and permission models from the frontend perspective.

---

## Table of Contents

1. [CRM Module](#crm-module)
2. [Admin Module](#admin-module)
3. [Hierarchy Module](#hierarchy-module)
4. [Shared Services & Types](#shared-services--types)
5. [Sidebar Navigation](#sidebar-navigation)
6. [Permission Matrix](#permission-matrix)

---

## CRM Module

**Base Path:** `frontend/src/app/(protected)/crm`

### Overview

The CRM frontend is a loan case management system built as Next.js App Router pages. It handles the full lifecycle of a loan case—from creation and assignment through document management, note-taking, scheduled notifications, customer detail sheets, and a hierarchical approval workflow for changes.

All data operations are encapsulated in `frontend/src/lib/crm.ts`, which communicates with REST endpoints under `/crm/*` and `/admin/*` prefixes.

### Directory Structure

```
frontend/src/app/(protected)/crm
├── cases
│   ├── [id]
│   │   └── page.tsx          # Case Detail Page (~2,300 lines)
│   └── page.tsx              # Cases List Page (~1,100 lines)
└── notifications
    └── page.tsx              # Notifications Page (~430 lines)
```

There is **no `layout.tsx`** inside the CRM folder; pages inherit the protected route layout from `(protected)/layout.tsx`.

### Pages

#### `/crm/cases` — Cases List Page

A full-featured loan case management dashboard (client component).

**Features:**
- Paginated case table (20 per page)
- Search by case number, customer name, or email
- Filter by status, month (last 12 months), and team member
- **Individual / Team view toggle**
  - *Individual*: shows only cases assigned to the current user
  - *Team*: shows cases assigned to the user's subordinates (uses hierarchy service)
- Bulk select cases for export
- Create new cases via modal
- Quick-view customer detail sheet in a modal
- Case export as ZIP (async job with polling progress)

**Key State:**
- `cases`, `pagination`, `filters`
- `viewMode`: `'individual' | 'team'`
- `selectedCases`: string[] (for bulk export)
- `subordinates`: loaded from `hierarchyService.getAllMySubordinates()` for team view filtering

#### `/crm/cases/[id]` — Case Detail Page

The deep-dive view for a single case. This is a very large, feature-rich page.

**Features:**
- **Case Overview**: customer info and loan info cards
- **Status & Assignment** display with quick actions
- **Documents**: upload, download, preview (images/PDFs inline), bulk download as ZIP inside a case-named folder
- **Notes & Scheduled**: combined feed of notes and scheduled notifications
- **Activity Timeline**: vertical timeline UI of all case events
- **Change Requests**: approve/reject pending customer detail changes
- **Customer Detail Sheet**: upload Excel file, view parsed key-value data, inline edit, submit change requests
- **Case Deletion**: with "type DELETE to confirm" safeguard

**Permission-gated actions** via `useAuth().hasPermission(...)`:
- Upload documents
- Add notes
- Schedule notifications
- Edit customer detail sheet
- Approve/reject change requests
- Delete case
- Assign case / update status

#### `/crm/notifications` — Notifications Page

A centralized inbox for scheduled case notifications.

**Features:**
- List all user notifications with filters (read/unread, completion status, due date range)
- Stats cards: Total, Unread, Ongoing
- Mark notifications read/unread and ongoing/completed
- View linked case (navigates to case detail)
- Approve or reject pending **change requests** directly from notifications
- Inline display of change request details and status badges

### Data Models (from `frontend/src/lib/crm.ts`)

```typescript
interface Case {
  id: string;
  case_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  loan_type: string;
  loan_amount: number;
  source_type?: 'DSA' | 'DST' | null;
  current_status: string;
  created_at: string;
  updated_at: string;
  creator?: { id: string; email: string; name: string };
  current_assignee?: { id: string; email: string; name: string };
  assignments?: Assignment[];
}

interface Assignment {
  id: string;
  assigned_at: string;
  assignee: { id: string; email: string; name: string };
  assigner: { id: string; email: string; name: string };
}

interface Document {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
  uploader: { id: string; email: string; name: string };
}

interface Note {
  id: string;
  note: string;
  created_at: string;
  creator: { id: string; email: string; name: string };
  document?: Document;
}

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  user: { id: string; email: string; name: string };
  details: any;
}

interface ScheduleableUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface CaseNotification {
  id: string;
  case_id: string;
  case_number?: string;
  case_customer_name?: string;
  case_status?: string;
  scheduled_for: string;
  scheduled_by: { id: string; email: string; name: string };
  message?: string;
  scheduled_at: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED';
  is_read: boolean;
  completion_status: 'ONGOING' | 'COMPLETED';
  created_at: string;
  updated_at: string;
  document?: Document;
  change_request_id?: string;
  change_request_status?: string;
  change_request_changes?: any;
}

interface CreateCaseData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  loan_type: string;
  loan_amount: number;
  source_type?: 'DSA' | 'DST';
  documents?: FileList;
}
```

### Constants

```typescript
const LOAN_TYPES = ['PERSONAL', 'HOME', 'AUTO', 'BUSINESS', 'EDUCATION'];

const CASE_STATUSES = [
  'NEW', 'LOGIN', 'SALES_REWORK', 'CREDIT_REWORK',
  'CREDIT_UNDERWRITING', 'CREDIT_APPROVED', 'DISBURSED', 'REJECTED'
];
```

### API Endpoints Used

| Category | Method | Endpoint | Purpose |
|----------|--------|----------|---------|
| Cases | `POST` | `/crm/cases` | Create case (multipart/form-data) |
| Cases | `GET` | `/crm/cases` | List cases with filters |
| Cases | `GET` | `/crm/cases/:id` | Get single case |
| Cases | `DELETE` | `/crm/cases/:id` | Delete case |
| Cases | `POST` | `/crm/cases/:id/assign` | Assign case |
| Cases | `POST` | `/crm/cases/:id/status` | Update status |
| Documents | `POST` | `/crm/cases/:id/documents` | Upload document |
| Documents | `GET` | `/crm/cases/:id/documents` | List documents |
| Documents | `GET` | `/crm/documents/:id` | Download document (blob) |
| Notes | `POST` | `/crm/cases/:id/notes` | Add note (multipart) |
| Notes | `GET` | `/crm/cases/:id/notes` | List notes |
| Timeline | `GET` | `/crm/cases/:id/timeline` | Get timeline events |
| Scheduling | `GET` | `/crm/scheduleable-users` | Users available for scheduling |
| Scheduling | `POST` | `/crm/cases/:id/schedule` | Schedule notification (multipart) |
| Notifications | `GET` | `/crm/cases/:id/notifications` | Case-specific notifications |
| Notifications | `GET` | `/crm/notifications` | User's notifications |
| Notifications | `GET` | `/crm/notifications/unread-count` | Unread count |
| Notifications | `PATCH` | `/crm/notifications/:id/read` | Mark read/unread |
| Notifications | `PATCH` | `/crm/notifications/:id/completion` | Mark ongoing/completed |
| Detail Sheet | `POST` | `/crm/cases/:id/customer-detail-sheet` | Upload Excel sheet |
| Detail Sheet | `GET` | `/crm/cases/:id/customer-detail-sheet` | Retrieve parsed data |
| Template | `GET` | `/admin/customer-detail-template` | Get display template |
| Template | `POST` | `/admin/customer-detail-template` | Update display template |
| Change Requests | `POST` | `/crm/cases/:id/customer-detail-change-request` | Create change request |
| Change Requests | `GET` | `/crm/cases/:id/customer-detail-change-requests` | List case change requests |
| Change Requests | `GET` | `/crm/customer-detail-change-requests/pending` | All pending requests |
| Change Requests | `GET` | `/crm/customer-detail-change-requests/approvers` | Users who can approve |
| Change Requests | `POST` | `/crm/customer-detail-change-requests/:id/approve` | Approve request |
| Change Requests | `POST` | `/crm/customer-detail-change-requests/:id/reject` | Reject request |
| Export | `POST` | `/crm/cases/export` | Start export job |
| Export | `GET` | `/crm/cases/export/:jobId` | Poll job status |
| Export | `GET` | `/crm/cases/export/download/:jobId` | Download ZIP blob |
| Users | `GET` | `/admin/users` | Load all active users for assignment |

---

## Admin Module

**Base Path:** `frontend/src/app/(protected)/admin`

### Overview

The admin module is a comprehensive RBAC administration panel built with Next.js App Router. It covers identity & access management, organization structure, observability, communication, and financial template configuration.

All pages are client components (`'use client'`), use consistent UI patterns (PageHeader, Table, Modal, Button, Input, Dropdown), and integrate with REST APIs under `/admin/*` and `/finance/*` prefixes.

### Directory Structure

```
frontend/src/app/(protected)/admin/
├── page.tsx                           # Admin root (redirects to /admin/users)
├── users/
│   └── page.tsx                       # User management
├── roles/
│   └── page.tsx                       # Role & permission management
├── teams/
│   └── page.tsx                       # Team management
├── hierarchy/
│   └── page.tsx                       # Reporting hierarchy (manager-subordinate)
├── audit-logs/
│   └── page.tsx                       # System audit & error logs
├── announcements/
│   └── page.tsx                       # Company announcements
└── templates/
    ├── cam/
    │   └── page.tsx                   # CAM (Credit Assessment Memo) templates
    ├── obligation/
    │   └── page.tsx                   # Obligation sheet templates
    └── customer-detail/
        └── page.tsx                   # Customer detail popup template
```

### Pages

| Page | Route | Purpose |
|------|-------|---------|
| **Admin Root** | `/admin` | Auto-redirects to `/admin/users` |
| **Users** | `/admin/users` | CRUD for user accounts; assign/remove roles; activate/deactivate users |
| **Roles** | `/admin/roles` | CRUD for roles; bulk assign/remove permissions per role; categorized permissions |
| **Teams** | `/admin/teams` | Create teams, view member counts (edit is stubbed) |
| **Hierarchy** | `/admin/hierarchy` | Visual tree of manager-subordinate relationships; assign/remove managers |
| **Audit Logs** | `/admin/audit-logs` | View paginated system activity & error logs; filter by type/month |
| **Announcements** | `/admin/announcements` | Create/delete company announcements with image upload support |
| **CAM Templates** | `/admin/templates/cam` | Build loan-type-specific CAM templates with sections & fields |
| **Obligation Templates** | `/admin/templates/obligation` | Build obligation sheet templates with repeatable fields |
| **Customer Detail Template** | `/admin/templates/customer-detail` | Toggle visibility & ordering of fields in customer detail popups |

### Key Features

#### Users Management (`/admin/users`)
- Create/edit users (email, password, first/last name, active status)
- Role assignment modal with checkboxes (handles both string & object role formats)
- Delete users with confirmation dialog
- Status badges (Active/Inactive)

#### Roles Management (`/admin/roles`)
- Create/edit roles with description
- **Permission management modal** categorizes permissions by prefix (`crm`, `finance`, `admin`, `Other`)
- Bulk Select All / Deselect All per category
- Shows user count & permission count per role
- Delete roles with confirmation

#### Teams Management (`/admin/teams`)
- Create teams (name + description)
- View member count
- Delete teams
- **Note:** Edit action is currently a no-op (`onClick: () => {}`)

#### Reporting Hierarchy (`/admin/hierarchy`)
- Interactive tree visualization with expand/collapse
- Color-coded depth levels (L0 primary, L1 blue, L2 indigo, L3 purple, etc.)
- Assign Manager modal with dropdown selectors
- Remove Manager confirmation
- Quick Start Guide shown when all users are at top level

#### Audit Logs (`/admin/audit-logs`)
- Pagination (50 logs/page)
- Filters: Log Type (`all` | `audit` | `error`) and Month (last 12 months)
- Dual display: Audit logs show action/resource; Error logs show message/code/stack trace

#### Announcements (`/admin/announcements`)
- Create with title, content, category (`GENERAL` | `BANK_UPDATES` | `SALES_REPORT`)
- Optional image upload (multipart/form-data)
- Category badges & status indicators
- Delete with confirmation

#### Template Builders (`/admin/templates/cam` & `/admin/templates/obligation`)
- Section-based field organization
- Field types: `text`, `number`, `currency`, `date`, `select`
- Drag-like reordering (up/down buttons)
- Mandatory & user-addable flags (CAM); repeatable flag (Obligation)
- Select options via comma-separated input
- Validation before save

#### Customer Detail Template (`/admin/templates/customer-detail`)
- ~30 default fields mapped from Excel sheet
- Toggle visibility per field
- Save / Reset to defaults

### Data Models

#### User (`admin/users/page.tsx`)
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: string[];
  roleIds?: string[];
  createdAt: string;
}
```

#### Role (`admin/roles/page.tsx`)
```typescript
interface Role {
  id: string;
  name: string;
  description: string | null;
  user_count: number;
  permission_count: number;
  created_at: string;
  permissions?: Permission[];
}

interface Permission {
  id: string;
  name: string;
  description: string | null;
}
```

#### Team (`admin/teams/page.tsx`)
```typescript
interface Team {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  created_at: string;
}
```

#### Audit Log (`admin/audit-logs/page.tsx`)
```typescript
interface AuditLog {
  id: string;
  action?: string;
  resource_type?: string;
  resource_id?: string | null;
  error_message?: string;
  error_stack?: string;
  error_code?: string;
  path?: string;
  method?: string;
  user_name: string;
  user_email: string;
  ip_address: string | null;
  created_at: string;
  details?: any;
  log_type?: 'audit' | 'error';
}
```

#### Announcement (`admin/announcements/page.tsx`)
```typescript
interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  category: 'GENERAL' | 'BANK_UPDATES' | 'SALES_REPORT';
  image_path?: string | null;
  author_name: string;
  author_email: string;
  created_at: string;
}
```

#### CAM / Obligation Templates (`frontend/src/lib/finance.ts`)
```typescript
interface CAMTemplate {
  id: string;
  loan_type: string;
  template_name: string;
  sections: string[];
  is_active: boolean;
  fields?: CAMField[];
}

interface CAMField {
  id: string;
  template_id: string;
  section_name: string;
  field_key: string;
  label: string;
  field_type: string;
  is_mandatory: boolean;
  is_user_addable: boolean;
  order_index: number;
  // ...
}

interface ObligationTemplate {
  id: string;
  template_name: string;
  sections: string[];
  is_active: boolean;
  fields?: ObligationField[];
}

interface ObligationField {
  id: string;
  template_id: string;
  field_key: string;
  label: string;
  field_type: string;
  is_mandatory: boolean;
  is_repeatable: boolean;
  order_index: number;
  // ...
}
```

### API Endpoints Used

| Page | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| **Users** | `/admin/users` | `GET` | List all users |
| **Users** | `/admin/users` | `POST` | Create user |
| **Users** | `/admin/users/:id` | `GET` | Fetch user details |
| **Users** | `/admin/users/:id` | `PATCH` | Update user |
| **Users** | `/admin/users/:id` | `DELETE` | Delete user |
| **Users** | `/admin/users/:id/roles` | `POST` | Assign role |
| **Users** | `/admin/users/:id/roles/:roleId` | `DELETE` | Remove role |
| **Users** | `/admin/roles` | `GET` | List all roles (for dropdown) |
| **Roles** | `/admin/roles` | `GET` | List roles with counts |
| **Roles** | `/admin/roles` | `POST` | Create role |
| **Roles** | `/admin/roles/:id` | `GET` | Fetch role details |
| **Roles** | `/admin/roles/:id` | `PATCH` | Update role |
| **Roles** | `/admin/roles/:id` | `DELETE` | Delete role |
| **Roles** | `/admin/permissions` | `GET` | List all permissions |
| **Roles** | `/admin/roles/:id/permissions` | `POST` | Assign permission |
| **Roles** | `/admin/roles/:id/permissions/:pid` | `DELETE` | Remove permission |
| **Teams** | `/admin/teams` | `GET` | List teams |
| **Teams** | `/admin/teams` | `POST` | Create team |
| **Teams** | `/admin/teams/:id` | `DELETE` | Delete team |
| **Hierarchy** | `/admin/hierarchy/tree` | `GET` | Get hierarchy tree |
| **Hierarchy** | `/admin/hierarchy/assign` | `POST` | Assign manager |
| **Hierarchy** | `/admin/hierarchy/remove` | `DELETE` | Remove manager |
| **Hierarchy** | `/admin/users` | `GET` | List users for dropdowns |
| **Audit Logs** | `/admin/audit-logs` | `GET` | List logs (paginated, filtered) |
| **Announcements** | `/admin/announcements` | `GET` | List announcements |
| **Announcements** | `/admin/announcements` | `POST` | Create announcement (multipart) |
| **Announcements** | `/admin/announcements/:id` | `DELETE` | Delete announcement |
| **CAM Templates** | `/finance/templates/cam` | `GET` | List CAM templates |
| **CAM Templates** | `/finance/templates/cam/:id` | `GET` | Get template details |
| **CAM Templates** | `/finance/templates/cam` | `POST` | Create template |
| **CAM Templates** | `/finance/templates/cam/:id` | `PUT` | Update template |
| **Obligation Templates** | `/finance/templates/obligation` | `GET` | List obligation templates |
| **Obligation Templates** | `/finance/templates/obligation/:id` | `GET` | Get template details |
| **Obligation Templates** | `/finance/templates/obligation` | `POST` | Create template |
| **Obligation Templates** | `/finance/templates/obligation/:id` | `PUT` | Update template |
| **Customer Detail** | `/admin/customer-detail-template` | `GET` | Get current template |
| **Customer Detail** | `/admin/customer-detail-template` | `POST` | Update template |

---

## Hierarchy Module

**Important:** There is **no** `frontend/src/app/(protected)/hierarchy` directory. Hierarchy functionality is distributed across admin, tasks, CRM, and shared services.

### Overview

The hierarchy system implements a **manager-subordinate reporting tree** where each user can have at most one direct manager. This tree drives:
- Team view filtering in CRM cases
- Scheduleable user lists (upward/downward in hierarchy)
- Change request approver selection
- Hierarchical task assignment (upward/downward)
- Admin visualization of the org tree

### Files & Routes

| File | Route | Purpose |
|------|-------|---------|
| `frontend/src/app/(protected)/admin/hierarchy/page.tsx` | `/admin/hierarchy` | Admin reporting hierarchy management |
| `frontend/src/app/(protected)/tasks/hierarchy/page.tsx` | `/tasks/hierarchy` | Hierarchical task management |
| `frontend/src/lib/hierarchy.ts` | — | Shared service & types for hierarchy |
| `frontend/src/lib/tasks.ts` | — | Task API wrappers + task types |
| `frontend/src/components/Sidebar.tsx` | — | Navigation links to hierarchy pages |
| `frontend/src/app/(protected)/crm/cases/page.tsx` | `/crm/cases` | Team view via subordinate list |
| `frontend/src/app/(protected)/crm/cases/[id]/page.tsx` | `/crm/cases/[id]` | Scheduling & change request approvers |

### Admin Hierarchy Page (`/admin/hierarchy`)

**Permission required:** `admin.hierarchy.manage`

A full admin interface to visualize and manage the organization's manager-subordinate reporting tree.

**Features:**
- **Interactive Tree View:** Renders the hierarchy as an expandable/collapsible tree with color-coded depth levels
- **Assign Manager:** Opens a modal to select a subordinate and assign them a manager (prevents self-assignment)
- **Remove Manager:** Removes a manager relationship (only for users at depth > 0)
- **Quick Start Guide:** Shown when all active users are at the top level with no managers assigned
- **Refresh Button:** Reloads the full tree and user list

**State Management:**
- `tree` — full hierarchy tree + maxDepth
- `users` — all users from `/admin/users`
- `expandedNodes` — which tree nodes are expanded
- `assignModalOpen`, `removeModalOpen` — modal visibility
- `formData` — `{ subordinateId, managerId }`

### Hierarchical Tasks Page (`/tasks/hierarchy`)

**Permission required:** `task.view.subordinates`

Allows users to create and manage tasks that flow **downward** (to subordinates) or **upward** (to their manager) within the reporting hierarchy.

**Features:**
- **Three Tabs:**
  1. **Assigned to Me** — tasks the current user needs to work on
  2. **Assigned by Me** — tasks the user created for subordinates
  3. **Subordinate Tasks** — view all tasks assigned to the user's subordinates
- **Create Task Modal:**
  - **DOWNWARD:** Assign task to any direct subordinate
  - **UPWARD:** Raise task to the user's direct manager (auto-filled)
- **Status Actions:** Users can "Start" (OPEN → IN_PROGRESS) and "Complete" (IN_PROGRESS → COMPLETED) tasks assigned to them.

**State Management:**
- `tasks` — current tab's task list
- `subordinates` — user's direct subordinates
- `manager` — user's direct manager
- `direction` — `'DOWNWARD' | 'UPWARD'`
- `activeTab` — `'assigned-to-me' | 'assigned-by-me' | 'subordinates'`

### Hierarchy in CRM Cases

**Cases List (`/crm/cases`):**
- **Team View Toggle:** Switches between "Individual" (my cases) and "Team" (subordinates' cases)
- When in **Team view**, calls `hierarchyService.getAllMySubordinates()` to populate a user filter dropdown
- The user filter allows filtering cases by a specific subordinate
- Also passes `view_type: 'team'` to the cases API

**Case Detail (`/crm/cases/[id]`):**
- **Schedule Feature:** Uses `crmService.getScheduleableUsers()` which returns users **above** and **below** in the hierarchy for scheduling notifications
- **Change Request Approvers:** `loadAvailableApprovers()` loads users with modify permission who are above the current user in the hierarchy for approving customer detail changes

### Data Models (from `frontend/src/lib/hierarchy.ts`)

```typescript
interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface HierarchyNode {
  user: User;
  manager?: HierarchyNode;
  subordinates: HierarchyNode[];
  depth: number;
}

interface HierarchyTree {
  root: HierarchyNode[];
  maxDepth: number;
}
```

### Task Types (from `frontend/src/lib/tasks.ts`)

```typescript
interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_by: string;
  task_type: 'PERSONAL' | 'COMMON' | 'HIERARCHICAL';
  direction: 'DOWNWARD' | 'UPWARD' | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  due_date: string | null;
  assignee?: User;
  assigner?: User;
}
```

### Service Methods (`frontend/src/lib/hierarchy.ts`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `assignManager(data)` | `POST /admin/hierarchy/assign` | Admin: assign manager |
| `removeManager(data)` | `DELETE /admin/hierarchy/remove` | Admin: remove manager |
| `getHierarchyTree()` | `GET /admin/hierarchy/tree` | Admin: fetch full tree |
| `getMyManager()` | `GET /users/me/manager` | Current user's manager (404 → null) |
| `getMySubordinates()` | `GET /users/me/subordinates` | Direct subordinates only |
| `getAllMySubordinates()` | `GET /users/me/subordinates/all` | All subordinates recursively |

---

## Shared Services & Types

### `frontend/src/lib/crm.ts`
Central CRM service. Exports:
- All CRM data types (`Case`, `Document`, `Note`, `TimelineEvent`, `CaseNotification`, etc.)
- API methods for cases, documents, notes, timeline, scheduling, notifications, detail sheets, change requests, and export

### `frontend/src/lib/hierarchy.ts`
Hierarchy service. Exports:
- `User`, `HierarchyNode`, `HierarchyTree` types
- Admin hierarchy management methods
- Current-user hierarchy query methods

### `frontend/src/lib/tasks.ts`
Task service. Exports:
- `Task` type and related types
- CRUD methods for task management

### `frontend/src/lib/finance.ts`
Finance service. Exports:
- `CAMTemplate`, `CAMField`, `ObligationTemplate`, `ObligationField` types
- Template CRUD methods

### `frontend/src/lib/api.ts`
Axios instance with interceptors for:
- Attaching JWT access token to requests
- Automatic token refresh on 401 responses
- Request/response logging

---

## Sidebar Navigation

The sidebar is defined in `frontend/src/components/Sidebar.tsx`. It groups navigation items by section and conditionally renders them based on user permissions.

### CRM Section

| Item | Route | Required Permission |
|------|-------|---------------------|
| Cases | `/crm/cases` | `crm.case.view` |
| Notifications | `/crm/notifications` | `crm.case.view` |

### Administration Section

**Note:** The entire Administration section is **hidden** from the sidebar if the user has none of these permissions.

| Item | Route | Required Permission |
|------|-------|---------------------|
| Users | `/admin/users` | `admin.users.read` |
| Roles | `/admin/roles` | `admin.roles.read` |
| Teams | `/admin/teams` | `admin.teams.read` |
| Announcements | `/admin/announcements` | `admin.announcements.read` |
| Audit Logs | `/admin/audit-logs` | `admin.audit.read` |
| Hierarchy | `/admin/hierarchy` | `admin.hierarchy.manage` |
| CAM Templates | `/admin/templates/cam` | `finance.template.manage` |
| Obligation Templates | `/admin/templates/obligation` | `finance.template.manage` |
| Customer Detail Template | `/admin/templates/customer-detail` | `admin.users.read` |

### Productivity Section

| Item | Route | Required Permission |
|------|-------|---------------------|
| Hierarchy Tasks | `/tasks/hierarchy` | `task.view.subordinates` |

**Active State:** The sidebar uses `pathname.startsWith(href)` for active state highlighting, so child routes like `/crm/cases/abc-123` correctly highlight the parent Cases nav item.

---

## Permission Matrix

This matrix summarizes the permissions required to access each frontend page and perform key actions.

| Module | Page / Action | Permission |
|--------|---------------|------------|
| **CRM** | View cases list | `crm.case.view` |
| **CRM** | Create case | `crm.case.create` |
| **CRM** | View case detail | `crm.case.view` |
| **CRM** | Assign case | `crm.case.assign` |
| **CRM** | Update status | `crm.case.update_status` |
| **CRM** | Upload document | `crm.case.upload_document` |
| **CRM** | Add note | `crm.case.add_note` |
| **CRM** | View notifications | `crm.case.view` |
| **CRM** | Schedule notification | `crm.case.schedule` |
| **CRM** | Edit customer detail sheet | `crm.case.edit_detail_sheet` |
| **CRM** | Approve change request | `crm.case.approve_changes` |
| **CRM** | Export cases | `crm.case.export` |
| **Admin** | View users | `admin.users.read` |
| **Admin** | Create/edit/delete users | `admin.users.manage` |
| **Admin** | View roles | `admin.roles.read` |
| **Admin** | Create/edit/delete roles | `admin.roles.manage` |
| **Admin** | View teams | `admin.teams.read` |
| **Admin** | Create/delete teams | `admin.teams.manage` |
| **Admin** | View hierarchy tree | `admin.hierarchy.manage` |
| **Admin** | Assign/remove manager | `admin.hierarchy.manage` |
| **Admin** | View audit logs | `admin.audit.read` |
| **Admin** | View announcements | `admin.announcements.read` |
| **Admin** | Create/delete announcements | `admin.announcements.manage` |
| **Admin** | Manage CAM templates | `finance.template.manage` |
| **Admin** | Manage Obligation templates | `finance.template.manage` |
| **Admin** | Manage Customer Detail template | `admin.users.read` |
| **Tasks** | View hierarchy tasks | `task.view.subordinates` |
| **Tasks** | Create hierarchical task | `task.create.hierarchical` |
| **Tasks** | Update task status | `task.update.own` |

---

## Related Documents

- [`CRM.md`](./CRM.md) — Backend-focused CRM documentation (database schema, API specs)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System architecture overview
- [`PERMISSIONS.md`](./PERMISSIONS.md) — Permission system details
- [`API.md`](./API.md) — Full API endpoint documentation

---

*Document generated from frontend source code analysis.*
