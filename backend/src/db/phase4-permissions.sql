-- Phase 4 Permissions: Tasks, Notes & Hierarchical Productivity
-- Run this after the Phase 4 migration

-- Insert Task permissions
INSERT INTO auth_schema.permissions (name, description) VALUES
  ('task.create.personal', 'Create personal tasks'),
  ('task.create.common', 'Create common tasks (admin/management only)'),
  ('task.assign.downward', 'Assign tasks to subordinates'),
  ('task.raise.upward', 'Raise tasks to manager'),
  ('task.view.subordinates', 'View subordinate tasks'),
  ('task.update.status', 'Update task status'),
  ('note.create', 'Create notes'),
  ('note.view.case', 'View case-linked notes')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to appropriate roles
-- All authenticated users get basic task and note permissions
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name IN ('employee', 'manager', 'admin', 'super_admin')
  AND p.name IN ('task.create.personal', 'task.update.status', 'note.create')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Managers get hierarchical task permissions
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name IN ('manager', 'admin', 'super_admin')
  AND p.name IN ('task.assign.downward', 'task.raise.upward', 'task.view.subordinates')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admins get common task creation permission
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name IN ('admin', 'super_admin')
  AND p.name = 'task.create.common'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Users with case view permission also get case note view
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE EXISTS (
  SELECT 1 FROM auth_schema.role_permissions rp2
  JOIN auth_schema.permissions p2 ON rp2.permission_id = p2.id
  WHERE rp2.role_id = r.id AND p2.name = 'crm.case.view'
)
AND p.name = 'note.view.case'
ON CONFLICT (role_id, permission_id) DO NOTHING;

