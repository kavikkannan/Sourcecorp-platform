-- Chat Permissions Migration
-- Adds new permissions for enhanced chat system

-- Add new permissions
INSERT INTO auth_schema.permissions (name, description)
VALUES 
  ('chat.channel.request', 'Request creation of new chat channels'),
  ('chat.channel.approve', 'Approve or reject channel creation requests'),
  ('chat.dm.start', 'Start direct message conversations')
ON CONFLICT (name) DO NOTHING;

-- Grant chat.channel.request to all authenticated users
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE p.name = 'chat.channel.request'
AND r.name IN ('employee', 'manager', 'admin', 'super_admin')
ON CONFLICT DO NOTHING;

-- Grant chat.channel.approve to managers and admins
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE p.name = 'chat.channel.approve'
AND r.name IN ('manager', 'admin', 'super_admin')
ON CONFLICT DO NOTHING;

-- Grant chat.dm.start to all authenticated users
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE p.name = 'chat.dm.start'
AND r.name IN ('employee', 'manager', 'admin', 'super_admin')
ON CONFLICT DO NOTHING;

