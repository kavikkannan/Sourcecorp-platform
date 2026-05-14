# Business Rules Documentation

## CRM

### Case Lifecycle
```
NEW → IN_PROGRESS → PENDING → COMPLETED
  ↓        ↓           ↓
HOLD  CUSTOMER_NOT_RESPONDING  NOT_INTERESTED
```

**Allowed Transitions:**
- `NEW` → `IN_PROGRESS`, `HOLD`, `NOT_INTERESTED`
- `IN_PROGRESS` → `PENDING`, `COMPLETED`, `HOLD`, `CUSTOMER_NOT_RESPONDING`, `NOT_INTERESTED`
- `PENDING` → `IN_PROGRESS`, `COMPLETED`, `HOLD`, `CUSTOMER_NOT_RESPONDING`
- `HOLD` → `IN_PROGRESS`, `NOT_INTERESTED`
- `CUSTOMER_NOT_RESPONDING` → `IN_PROGRESS`, `NOT_INTERESTED`
- `NOT_INTERESTED` → terminal state (no transitions)
- `COMPLETED` → terminal state (no transitions)

### Case Assignment
- One case can be assigned to one user at a time
- Previous assignment is superseded by new assignment
- Assignment creates an entry in `case_assignments` table

### Case Number Generation
- Auto-generated on INSERT: `SC-{YYYY}-{sequence}`
- Sequence resets yearly
- Example: `SC-2024-0001`

## Financial Tools

### CAM (Credit Appraisal Memorandum)
- Template-based form generation
- Fields grouped by sections
- Each field has validation rules (min, max, pattern)
- Loan type determines which template is used
- Supports custom fields (user-defined)
- Version history maintained on each save

### Obligation Sheet
- Based on obligation template
- Fields grouped by sections
- Calculates:
  - Total Monthly Obligation (sum of all obligations)
  - Available Income (Net Income - Total Obligation)
- Color coding:
  - Green: Available Income > 30% of Net Income
  - Yellow: Available Income 10-30% of Net Income
  - Red: Available Income < 10% of Net Income

### Eligibility Calculator
- Uses eligibility rules per loan type
- Factors: income, obligations, credit score
- Returns: eligible amount, interest rate, tenure options

## Tasks

### Hierarchy Rules
- **Downward Assignment**: Manager can assign tasks to direct subordinates
- **Upward Assignment**: Subordinate can assign tasks to direct manager
- **Validation**: Task assignment is blocked if hierarchy rule is violated

### Status Flow
```
TODO → IN_PROGRESS → REVIEW → COMPLETED
  ↓        ↓
BLOCKED  ON_HOLD
```

### Notifications
- Task creation → notify assignee
- Status change → notify creator
- Overdue → daily reminder to assignee

## User Management

### Roles
- Built-in roles: `admin`, `manager`, `user`
- Custom roles can be created via admin panel
- Roles have a set of permissions

### Hierarchy
- Manager-subordinate relationship stored in `user_hierarchy`
- One user can have one direct manager
- Circular references are prevented by database trigger
- Self-reference is not allowed

### Teams
- Users can belong to multiple teams
- Teams can have team leads
- Used for task assignment and case routing

## Permissions

### Permission Naming Convention
```
{module}.{resource}.{action}
```

Examples:
- `crm.case.create`
- `admin.user.read`
- `finance.template.manage`
- `task.update.status`

### Permission Assignment
- Permissions are assigned to roles
- Users inherit permissions through their roles
- Changes require re-login to take effect (JWT caching)

## Audit & Compliance

### Audit Logging
- Every create/update/delete is logged
- Log entry includes: user, action, entity, old/new values, timestamp
- Audit logs are immutable
- Retention: 7 years (configurable)

### Data Privacy
- User data is encrypted at rest (PostgreSQL)
- Passwords hashed with bcrypt (salt rounds: 10)
- PII fields: name, email, phone, address
