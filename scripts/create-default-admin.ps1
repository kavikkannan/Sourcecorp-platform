# SourceCorp Platform - Create Default Admin User
# Email: admin@gmail.com
# Password: kk

Write-Host "========================================"
Write-Host "Creating Default Admin User"
Write-Host "========================================"
Write-Host ""

$ADMIN_EMAIL = "admin@gmail.com"
$ADMIN_PASSWORD = "kk"
$ADMIN_FIRST_NAME = "Admin"
$ADMIN_LAST_NAME = "User"

Write-Host "Email: $ADMIN_EMAIL"
Write-Host "Password: $ADMIN_PASSWORD"
Write-Host ""

# Check if docker-compose is running
$services = docker-compose ps 2>&1 | Select-String "Up"
if (-not $services) {
    Write-Host "Error: Docker services are not running."
    Write-Host "Please run 'docker-compose up -d' first."
    exit 1
}

Write-Host "Generating password hash..."

# Generate password hash
$PASSWORD_HASH = docker-compose exec -T backend node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$ADMIN_PASSWORD', 10));" 2>&1 | Select-Object -Last 1
$PASSWORD_HASH = $PASSWORD_HASH.Trim()

Write-Host "Creating admin user..."

# SQL script to create admin user and assign permissions
$SQL_SCRIPT = @"
-- Create admin user
INSERT INTO auth_schema.users (email, password_hash, first_name, last_name)
VALUES ('$ADMIN_EMAIL', '$PASSWORD_HASH', '$ADMIN_FIRST_NAME', '$ADMIN_LAST_NAME')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name;

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
('task.view.subordinates', 'View subordinate tasks'),
('crm.case.create', 'Create loan cases'),
('crm.case.view', 'View loan cases'),
('crm.case.assign', 'Assign cases'),
('crm.case.update_status', 'Update case status'),
('crm.case.upload_document', 'Upload documents'),
('crm.case.add_note', 'Add notes'),
('finance.eligibility.calculate', 'Calculate eligibility'),
('finance.eligibility.view', 'View eligibility'),
('finance.obligation.create', 'Create obligation sheet'),
('finance.obligation.view', 'View obligation sheet'),
('finance.obligation.edit', 'Edit obligation sheet'),
('finance.cam.create', 'Create CAM entry'),
('finance.cam.view', 'View CAM entry'),
('finance.cam.edit', 'Edit CAM entry'),
('finance.export', 'Export financial data'),
('finance.template.manage', 'Manage financial templates')
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
WHERE u.email = '$ADMIN_EMAIL' AND r.name = 'Admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
"@

# Execute SQL
$SQL_SCRIPT | docker-compose exec -T postgres psql -U sourcecorp_user -d sourcecorp 2>&1 | Out-Null

Write-Host ""
Write-Host "========================================"
Write-Host "Admin user created successfully!"
Write-Host "========================================"
Write-Host ""
Write-Host "Login credentials:"
Write-Host "  Email: $ADMIN_EMAIL"
Write-Host "  Password: $ADMIN_PASSWORD"
Write-Host ""
Write-Host "Access the platform at: http://localhost"
Write-Host ""

