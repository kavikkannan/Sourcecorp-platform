# Permission Reference

This document lists all available permissions in Phase 1 of the SourceCorp Platform.

## Permission Naming Convention

Permissions follow the pattern: `resource.action`

Example: `admin.users.create`

## Available Permissions

### Dashboard
- `admin.dashboard.read` - View the admin dashboard

### User Management
- `admin.users.read` - View user list and details
- `admin.users.create` - Create new users
- `admin.users.update` - Edit user information
- `admin.users.assign_role` - Assign roles to users
- `admin.users.remove_role` - Remove roles from users

### Role Management
- `admin.roles.read` - View role list and details
- `admin.roles.create` - Create new roles
- `admin.roles.update` - Edit role information
- `admin.roles.delete` - Delete roles
- `admin.roles.assign_permission` - Assign permissions to roles
- `admin.roles.remove_permission` - Remove permissions from roles

### Permission Management
- `admin.permissions.read` - View permission list
- `admin.permissions.create` - Create new permissions
- `admin.permissions.update` - Edit permission information
- `admin.permissions.delete` - Delete permissions

### Team Management
- `admin.teams.read` - View team list and details
- `admin.teams.create` - Create new teams
- `admin.teams.update` - Edit team information
- `admin.teams.delete` - Delete teams
- `admin.teams.add_member` - Add members to teams
- `admin.teams.remove_member` - Remove members from teams

### Announcement Management
- `admin.announcements.read` - View announcements
- `admin.announcements.create` - Create announcements
- `admin.announcements.update` - Edit announcements
- `admin.announcements.delete` - Delete announcements

### Audit Logs
- `admin.audit.read` - View audit logs (read-only)

## Default Role: Admin

The Admin role should have all of the above permissions by default.

## Creating Custom Roles

Example: Support Team Lead

Permissions:
- `admin.dashboard.read`
- `admin.users.read`
- `admin.teams.read`
- `admin.announcements.read`
- `admin.announcements.create`
- `admin.audit.read`

Example: HR Manager

Permissions:
- `admin.dashboard.read`
- `admin.users.read`
- `admin.users.create`
- `admin.users.update`
- `admin.teams.read`
- `admin.teams.create`
- `admin.teams.update`
- `admin.teams.add_member`
- `admin.teams.remove_member`

Example: Security Auditor

Permissions:
- `admin.audit.read`
- `admin.users.read`
- `admin.roles.read`

## API Enforcement

All permissions are enforced at the API level using the `requirePermission` middleware:

```typescript
router.post(
  '/admin/users',
  requirePermission('admin.users.create'),
  UsersController.createUser
);
```

Frontend checks are for UX only and do not provide security.

## Adding New Permissions

To add a new permission:

1. **Insert into database:**
   ```sql
   INSERT INTO auth_schema.permissions (name, description)
   VALUES ('module.resource.action', 'Description of what this allows');
   ```

2. **Apply to API routes:**
   ```typescript
   router.get('/api/new-route', 
     requirePermission('module.resource.action'),
     Controller.method
   );
   ```

3. **Update frontend route guards if needed:**
   ```typescript
   <ProtectedRoute requiredPermission="module.resource.action">
     <Component />
   </ProtectedRoute>
   ```

4. **Assign to appropriate roles:**
   ```sql
   INSERT INTO auth_schema.role_permissions (role_id, permission_id)
   SELECT r.id, p.id
   FROM auth_schema.roles r, auth_schema.permissions p
   WHERE r.name = 'RoleName' AND p.name = 'module.resource.action';
   ```

## Permission Hierarchy

Phase 1 uses a flat permission model. Future phases may introduce:
- Permission inheritance
- Permission groups
- Dynamic permissions
- Resource-level permissions (e.g., can only edit own team)

## Best Practices

1. **Principle of Least Privilege**: Only grant permissions that are necessary
2. **Regular Audits**: Review role permissions regularly
3. **Document Changes**: Keep track of permission changes in audit logs
4. **Test Access**: Verify users can only access what they should
5. **Separate Concerns**: Don't combine read and write permissions unnecessarily

