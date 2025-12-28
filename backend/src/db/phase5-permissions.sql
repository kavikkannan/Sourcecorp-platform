-- Phase 5 Permissions: Internal Chat & File Sharing
-- Run this after the Phase 5 chat migration

-- Insert Chat permissions
INSERT INTO auth_schema.permissions (name, description) VALUES
  ('chat.channel.create', 'Create new chat channels'),
  ('chat.channel.view', 'View chat channels'),
  ('chat.message.send', 'Send messages in chat channels'),
  ('chat.file.upload', 'Upload files in chat')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to appropriate roles
-- All authenticated users get basic chat permissions
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name IN ('employee', 'manager', 'admin', 'super_admin')
  AND p.name IN ('chat.channel.view', 'chat.message.send', 'chat.file.upload')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admins and managers can create channels
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name IN ('admin', 'super_admin', 'manager')
  AND p.name = 'chat.channel.create'
ON CONFLICT (role_id, permission_id) DO NOTHING;

