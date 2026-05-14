# CRM Module Documentation

## Overview

The CRM (Customer Relationship Management) module is the core loan case management engine of the SourceCorp Platform. It enables users to create, manage, and track loan applications from initial submission through final disposition.

## Features

### 1. Case Management
- Create new loan cases with customer information
- Auto-generated unique case numbers (CASE-YYYYMMDD-XXXXX)
- Track loan type, amount, and current status
- View case history and timeline

### 2. Case Assignment
- Assign cases to specific users
- Track assignment history
- Reassign cases as needed
- View current assignee

### 3. Status Management
- Update case status through defined workflow
- Add remarks when changing status
- Complete status change history
- Visual status indicators

### 4. Document Management
- Upload documents to cases
- Secure file storage
- Download documents with permission checks
- Track document metadata (uploader, timestamp, size)

### 5. Notes & Comments
- Add notes to cases
- Track note authors and timestamps
- View notes in chronological order

### 6. Timeline
- Unified timeline of all case activities
- Includes status changes, assignments, notes, and documents
- Chronological view with user attribution

### 7. Role-Based Access Control
- Employees see only their assigned cases
- Managers see team cases
- Admins see all cases
- Permission-based action visibility

## Case Statuses

| Status | Description | Color |
|--------|-------------|-------|
| NEW | Newly created case | Blue |
| ASSIGNED | Assigned to a user | Purple |
| IN_PROGRESS | Being actively worked on | Yellow |
| PENDING_DOCUMENTS | Waiting for customer documents | Orange |
| UNDER_REVIEW | Under management review | Indigo |
| APPROVED | Loan approved | Green |
| REJECTED | Loan rejected | Red |
| DISBURSED | Funds disbursed | Teal |
| CLOSED | Case closed | Gray |

## Loan Types

- **PERSONAL** - Personal Loan
- **HOME** - Home Loan
- **AUTO** - Auto Loan
- **BUSINESS** - Business Loan
- **EDUCATION** - Education Loan

## Permissions

| Permission | Description | Typical Roles |
|------------|-------------|---------------|
| crm.case.create | Create new cases | All users |
| crm.case.view | View cases (RBAC filtered) | All users |
| crm.case.view_all | View all cases | Admin only |
| crm.case.assign | Assign cases to users | Managers, Admins |
| crm.case.update_status | Update case status | Managers, Admins |
| crm.case.upload_document | Upload documents | All users |
| crm.case.add_note | Add notes to cases | All users |

## API Endpoints

### Cases

#### Create Case
```http
POST /api/crm/cases
Authorization: Bearer {token}
Content-Type: application/json

{
  "customer_name": "John Doe",
  "customer_email": "john@example.com",
  "customer_phone": "+1234567890",
  "loan_type": "PERSONAL",
  "loan_amount": 50000
}
```

#### List Cases
```http
GET /api/crm/cases?status=NEW&limit=20&offset=0
Authorization: Bearer {token}
```

Response:
```json
{
  "cases": [
    {
      "id": "uuid",
      "case_number": "CASE-20231224-00001",
      "customer_name": "John Doe",
      "customer_email": "john@example.com",
      "customer_phone": "+1234567890",
      "loan_type": "PERSONAL",
      "loan_amount": 50000,
      "current_status": "NEW",
      "created_at": "2023-12-24T10:00:00Z",
      "updated_at": "2023-12-24T10:00:00Z",
      "creator": {
        "id": "uuid",
        "email": "agent@example.com",
        "name": "Agent Name"
      },
      "current_assignee": null
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

#### Get Case Details
```http
GET /api/crm/cases/{id}
Authorization: Bearer {token}
```

### Assignment

#### Assign Case
```http
POST /api/crm/cases/{id}/assign
Authorization: Bearer {token}
Content-Type: application/json

{
  "assigned_to": "user-uuid"
}
```

### Status

#### Update Status
```http
POST /api/crm/cases/{id}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "new_status": "IN_PROGRESS",
  "remarks": "Started processing the application"
}
```

### Documents

#### Upload Document
```http
POST /api/crm/cases/{id}/documents
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [binary data]
```

#### List Documents
```http
GET /api/crm/cases/{id}/documents
Authorization: Bearer {token}
```

#### Download Document
```http
GET /api/crm/documents/{documentId}
Authorization: Bearer {token}
```

### Notes

#### Add Note
```http
POST /api/crm/cases/{id}/notes
Authorization: Bearer {token}
Content-Type: application/json

{
  "note": "Customer called to check status"
}
```

#### List Notes
```http
GET /api/crm/cases/{id}/notes
Authorization: Bearer {token}
```

### Timeline

#### Get Timeline
```http
GET /api/crm/cases/{id}/timeline
Authorization: Bearer {token}
```

Response:
```json
{
  "timeline": [
    {
      "id": "uuid",
      "type": "status_change",
      "timestamp": "2023-12-24T10:30:00Z",
      "user": {
        "id": "uuid",
        "email": "agent@example.com",
        "name": "Agent Name"
      },
      "details": {
        "from_status": "NEW",
        "to_status": "IN_PROGRESS",
        "remarks": "Started processing"
      }
    },
    {
      "id": "uuid",
      "type": "document",
      "timestamp": "2023-12-24T10:15:00Z",
      "user": {
        "id": "uuid",
        "email": "agent@example.com",
        "name": "Agent Name"
      },
      "details": {
        "file_name": "id_proof.pdf",
        "file_size": 102400
      }
    }
  ]
}
```

## Database Schema

### cases
```sql
CREATE TABLE crm_schema.cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    loan_type VARCHAR(100) NOT NULL,
    loan_amount DECIMAL(15, 2) NOT NULL,
    current_status VARCHAR(50) NOT NULL DEFAULT 'NEW',
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### case_assignments
```sql
CREATE TABLE crm_schema.case_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES auth_schema.users(id),
    assigned_by UUID NOT NULL REFERENCES auth_schema.users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### case_status_history
```sql
CREATE TABLE crm_schema.case_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES auth_schema.users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    remarks TEXT
);
```

### documents
```sql
CREATE TABLE crm_schema.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth_schema.users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### case_notes
```sql
CREATE TABLE crm_schema.case_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES crm_schema.cases(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth_schema.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Frontend Components

### Cases List Page
**Path:** `/crm/cases`

Features:
- Paginated case list
- Search by case number, customer name, or email
- Filter by status
- Create new case modal
- View case details

### Case Detail Page
**Path:** `/crm/cases/[id]`

Features:
- Customer information display
- Loan information display
- Current status and assignee
- Quick action buttons (Assign, Update Status, Upload, Add Note)
- Documents section with upload/download
- Notes section
- Activity timeline
- Multiple action modals

## Usage Examples

### Creating a Case

1. Navigate to CRM → Cases
2. Click "New Case" button
3. Fill in the form:
   - Customer Name: "John Doe"
   - Customer Email: "john@example.com"
   - Customer Phone: "+1234567890"
   - Loan Type: "Personal Loan"
   - Loan Amount: 50000
4. Click "Create Case"
5. Case is created with auto-generated case number

### Assigning a Case

1. Open case detail page
2. Click "Assign" button
3. Enter user UUID (or select from dropdown if implemented)
4. Click "Assign"
5. Case is assigned and status may update to "ASSIGNED"

### Updating Status

1. Open case detail page
2. Click "Update Status" button
3. Select new status from dropdown
4. Optionally add remarks
5. Click "Update"
6. Status is updated and recorded in history

### Uploading Documents

1. Open case detail page
2. Click "Upload Document" button
3. Select file from computer
4. Click "Upload"
5. Document is uploaded and appears in documents list

### Adding Notes

1. Open case detail page
2. Click "Add Note" button
3. Enter note text
4. Click "Add Note"
5. Note is added and appears in notes section and timeline

## Security

### Authentication
- All CRM endpoints require valid JWT token
- Token must be included in Authorization header

### Authorization
- Permission-based access control
- RBAC filtering at service layer
- Users see only cases they have access to

### File Security
- Files stored in secure Docker volume
- No direct file access from frontend
- Download requires permission check
- File paths not exposed to frontend

### Audit Logging
- All CRM actions logged
- Includes user ID, action, resource, details
- IP address and user agent tracked
- Immutable audit trail

## Best Practices

### For Developers

1. **Always use the service layer** - Don't query database directly from controllers
2. **Validate inputs** - Use Zod schemas for all inputs
3. **Check permissions** - Use RBAC middleware on all routes
4. **Log actions** - Use AuditService for all state changes
5. **Handle errors** - Provide meaningful error messages
6. **Test RBAC** - Verify access control with different roles

### For Users

1. **Keep case information updated** - Update status regularly
2. **Add meaningful notes** - Document important conversations and decisions
3. **Upload all required documents** - Ensure complete documentation
4. **Assign cases promptly** - Don't leave cases unassigned
5. **Use remarks when changing status** - Explain why status changed

## Troubleshooting

### Case not visible
- Check user permissions (crm.case.view)
- Verify case assignment (non-admins see only assigned cases)
- Check role configuration

### Cannot upload documents
- Verify permission (crm.case.upload_document)
- Check file size (max 10MB)
- Ensure uploads directory exists and is writable

### Cannot assign case
- Verify permission (crm.case.assign)
- Check that target user exists and is active
- Verify user UUID is correct

### Timeline not showing events
- Refresh the page
- Check that events were actually created
- Verify database queries are working

## Future Enhancements

Potential improvements for future phases:
- User picker for assignments (instead of UUID input)
- Advanced search and filtering
- Bulk operations
- Case templates
- Automated status transitions
- Email notifications
- Document templates
- Case analytics and reporting
- SLA tracking
- Workflow automation

## Support

For issues or questions:
1. Check this documentation
2. Review audit logs for error details
3. Check browser console for frontend errors
4. Check backend logs for API errors
5. Verify permissions are correctly assigned


