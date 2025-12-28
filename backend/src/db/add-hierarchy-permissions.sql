-- Add Hierarchy and Task Permissions
-- Run this to add the new permissions and assign them to Admin role

-- Insert hierarchy and task permissions
INSERT INTO auth_schema.permissions (name, description) VALUES
('admin.hierarchy.manage', 'Manage reporting hierarchy'),
('task.assign.downward', 'Assign tasks to subordinates'),
('task.raise.upward', 'Raise tasks to manager'),
('task.view.subordinates', 'View subordinate tasks')
ON CONFLICT (name) DO NOTHING;

-- Assign all new permissions to Admin role
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name = 'Admin' 
AND p.name IN (
  'admin.hierarchy.manage',
  'task.assign.downward',
  'task.raise.upward',
  'task.view.subordinates'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

