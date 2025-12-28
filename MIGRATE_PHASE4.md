# Phase 4 Migration Instructions

## Prerequisites

1. **Start Docker Compose** (if not already running):
   ```bash
   docker-compose up -d
   ```

2. **Wait for database to be ready** (usually takes 10-20 seconds)

## Running Migrations

### Option 1: Run Both Migrations Together (Recommended)

```bash
cd backend
npm run migrate:phase4-all
```

This will:
1. Run the schema migration (creates tables, extends existing tables)
2. Run the permissions migration (adds permissions and assigns them to roles)

### Option 2: Run Migrations Separately

```bash
cd backend

# Step 1: Run schema migration
npm run migrate:phase4

# Step 2: Run permissions migration
npm run migrate:phase4-permissions
```

## What Gets Migrated

### Schema Migration (`migrate:phase4`)
- Creates `note_schema`
- Extends `task_schema.tasks` table:
  - Adds `task_type` (PERSONAL | COMMON | HIERARCHICAL)
  - Adds `priority` (LOW | MEDIUM | HIGH)
  - Adds `linked_case_id` (nullable FK to cases)
  - Makes `direction` nullable for PERSONAL/COMMON tasks
- Creates `task_schema.task_comments` table
- Creates `note_schema.notes` table
- Updates validation triggers

### Permissions Migration (`migrate:phase4-permissions`)
- Adds 8 new permissions:
  - `task.create.personal`
  - `task.create.common`
  - `task.assign.downward`
  - `task.raise.upward`
  - `task.view.subordinates`
  - `task.update.status`
  - `note.create`
  - `note.view.case`

- Assigns permissions to roles:
  - **All users** (employee, manager, admin, super_admin): 
    - `task.create.personal`
    - `task.update.status`
    - `note.create`
  
  - **Managers and above** (manager, admin, super_admin):
    - `task.assign.downward`
    - `task.raise.upward`
    - `task.view.subordinates`
  
  - **Admins only** (admin, super_admin):
    - `task.create.common`
  
  - **Users with case view permission**:
    - `note.view.case` (automatically assigned)

## Verification

After migration, verify:

1. **Check tables exist:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema IN ('task_schema', 'note_schema')
   ORDER BY table_schema, table_name;
   ```

2. **Check permissions exist:**
   ```sql
   SELECT name, description FROM auth_schema.permissions 
   WHERE name LIKE 'task.%' OR name LIKE 'note.%'
   ORDER BY name;
   ```

3. **Check permissions assigned to roles:**
   ```sql
   SELECT r.name as role_name, p.name as permission_name
   FROM auth_schema.roles r
   JOIN auth_schema.role_permissions rp ON r.id = rp.role_id
   JOIN auth_schema.permissions p ON rp.permission_id = p.id
   WHERE p.name LIKE 'task.%' OR p.name LIKE 'note.%'
   ORDER BY r.name, p.name;
   ```

## Troubleshooting

### Connection Refused Error
- Make sure Docker Compose is running: `docker-compose ps`
- Check database is ready: `docker-compose logs db`
- Wait a few seconds and try again

### Permission Already Exists
- This is normal - the migration uses `ON CONFLICT DO NOTHING`
- Permissions won't be duplicated

### Migration Fails Partway
- Check what step failed in the logs
- You can re-run migrations safely (they're idempotent)
- Fix any issues and re-run

## Rollback

If you need to rollback (not recommended in production):

1. **Remove permissions:**
   ```sql
   DELETE FROM auth_schema.role_permissions 
   WHERE permission_id IN (
     SELECT id FROM auth_schema.permissions 
     WHERE name LIKE 'task.%' OR name LIKE 'note.%'
   );
   
   DELETE FROM auth_schema.permissions 
   WHERE name LIKE 'task.%' OR name LIKE 'note.%';
   ```

2. **Drop tables (WARNING: This deletes data):**
   ```sql
   DROP TABLE IF EXISTS note_schema.notes CASCADE;
   DROP TABLE IF EXISTS task_schema.task_comments CASCADE;
   DROP SCHEMA IF EXISTS note_schema CASCADE;
   
   -- Remove columns from tasks table
   ALTER TABLE task_schema.tasks 
   DROP COLUMN IF EXISTS task_type,
   DROP COLUMN IF EXISTS priority,
   DROP COLUMN IF EXISTS linked_case_id;
   ```

