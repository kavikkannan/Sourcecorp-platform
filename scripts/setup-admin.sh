#!/bin/bash

# SourceCorp Platform - Setup Admin User Script
# This script helps create the first admin user with all permissions

set -e

echo "========================================"
echo "SourceCorp Platform - Admin Setup"
echo "========================================"
echo ""

# Check if docker-compose is running
if ! docker-compose ps | grep -q "Up"; then
    echo "Error: Docker services are not running."
    echo "Please run 'docker-compose up -d' first."
    exit 1
fi

# Prompt for admin details
read -p "Admin Email: " ADMIN_EMAIL
read -sp "Admin Password: " ADMIN_PASSWORD
echo ""
read -p "Admin First Name: " ADMIN_FIRST_NAME
read -p "Admin Last Name: " ADMIN_LAST_NAME

echo ""
echo "Generating password hash..."

# Generate password hash
PASSWORD_HASH=$(docker-compose exec -T backend node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('${ADMIN_PASSWORD}', 10));")

echo "Creating admin user..."

# SQL script to create admin user and assign permissions
SQL_SCRIPT="
-- Create admin user
INSERT INTO auth_schema.users (email, password_hash, first_name, last_name)
VALUES ('${ADMIN_EMAIL}', '${PASSWORD_HASH}', '${ADMIN_FIRST_NAME}', '${ADMIN_LAST_NAME}')
ON CONFLICT (email) DO NOTHING;

-- Create admin role if not exists
INSERT INTO auth_schema.roles (name, description)
VALUES ('Admin', 'System Administrator')
ON CONFLICT (name) DO NOTHING;

-- Create all admin permissions
INSERT INTO auth_schema.permissions (name, description) VALUES
('admin.dashboard.read', 'View dashboard'),
('admin.users.read', 'View users'),
('admin.users.create', 'Create users'),
('admin.users.update', 'Update users'),
('admin.users.assign_role', 'Assign roles to users'),
('admin.users.remove_role', 'Remove roles from users'),
('admin.roles.read', 'View roles'),
('admin.roles.create', 'Create roles'),
('admin.roles.update', 'Update roles'),
('admin.roles.delete', 'Delete roles'),
('admin.roles.assign_permission', 'Assign permissions to roles'),
('admin.roles.remove_permission', 'Remove permissions from roles'),
('admin.permissions.read', 'View permissions'),
('admin.permissions.create', 'Create permissions'),
('admin.permissions.update', 'Update permissions'),
('admin.permissions.delete', 'Delete permissions'),
('admin.teams.read', 'View teams'),
('admin.teams.create', 'Create teams'),
('admin.teams.update', 'Update teams'),
('admin.teams.delete', 'Delete teams'),
('admin.teams.add_member', 'Add team members'),
('admin.teams.remove_member', 'Remove team members'),
('admin.announcements.read', 'View announcements'),
('admin.announcements.create', 'Create announcements'),
('admin.announcements.update', 'Update announcements'),
('admin.announcements.delete', 'Delete announcements'),
('admin.audit.read', 'View audit logs'),
('admin.hierarchy.manage', 'Manage reporting hierarchy'),
('task.assign.downward', 'Assign tasks to subordinates'),
('task.raise.upward', 'Raise tasks to manager'),
('task.view.subordinates', 'View subordinate tasks')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to admin role
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name = 'Admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign admin role to user
INSERT INTO auth_schema.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth_schema.users u, auth_schema.roles r
WHERE u.email = '${ADMIN_EMAIL}' AND r.name = 'Admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
"

# Execute SQL
echo "$SQL_SCRIPT" | docker-compose exec -T postgres psql -U sourcecorp_user -d sourcecorp

echo ""
echo "========================================"
echo "✓ Admin user created successfully!"
echo "========================================"
echo ""
echo "Login credentials:"
echo "  Email: ${ADMIN_EMAIL}"
echo "  Password: (the password you entered)"
echo ""
echo "Access the platform at: http://localhost"
echo ""

