-- Add crm.case.assign permission to Admin role
-- Run this to ensure Admin role has the assign permission

-- Assign crm.case.assign permission to Admin role
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name = 'Admin' 
AND p.name = 'crm.case.assign'
ON CONFLICT (role_id, permission_id) DO NOTHING;

