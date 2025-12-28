# API Documentation

Base URL: `http://localhost/api`

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### POST /auth/login

Login and get access tokens.

**Request:**
```json
{
  "email": "admin@sourcecorp.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "admin@sourcecorp.com",
    "firstName": "Admin",
    "lastName": "User"
  }
}
```

### POST /auth/refresh

Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

### POST /auth/logout

Logout and invalidate tokens.

**Headers:** Authorization required

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

### GET /auth/me

Get current user information with roles and permissions.

**Headers:** Authorization required

**Response:**
```json
{
  "id": "uuid",
  "email": "admin@sourcecorp.com",
  "firstName": "Admin",
  "lastName": "User",
  "isActive": true,
  "roles": ["Admin"],
  "permissions": ["admin.users.read", "admin.users.create", ...]
}
```

---

## Users

### GET /admin/users

Get all users.

**Permission:** `admin.users.read`

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "roles": ["Admin", "Manager"],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### GET /admin/users/:id

Get user by ID.

**Permission:** `admin.users.read`

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "roles": [
    {"id": "uuid", "name": "Admin"}
  ],
  "teams": ["Engineering", "Leadership"],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### POST /admin/users

Create a new user.

**Permission:** `admin.users.create`

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### PATCH /admin/users/:id

Update user information.

**Permission:** `admin.users.update`

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "isActive": false
}
```

### POST /admin/users/:userId/roles

Assign role to user.

**Permission:** `admin.users.assign_role`

**Request:**
```json
{
  "roleId": "uuid"
}
```

### DELETE /admin/users/:userId/roles/:roleId

Remove role from user.

**Permission:** `admin.users.remove_role`

---

## Roles

### GET /admin/roles

Get all roles.

**Permission:** `admin.roles.read`

### GET /admin/roles/:id

Get role by ID with permissions.

**Permission:** `admin.roles.read`

### POST /admin/roles

Create a new role.

**Permission:** `admin.roles.create`

**Request:**
```json
{
  "name": "Manager",
  "description": "Team manager role"
}
```

### PATCH /admin/roles/:id

Update role.

**Permission:** `admin.roles.update`

### DELETE /admin/roles/:id

Delete role.

**Permission:** `admin.roles.delete`

### POST /admin/roles/:roleId/permissions

Assign permission to role.

**Permission:** `admin.roles.assign_permission`

**Request:**
```json
{
  "permissionId": "uuid"
}
```

### DELETE /admin/roles/:roleId/permissions/:permissionId

Remove permission from role.

**Permission:** `admin.roles.remove_permission`

---

## Permissions

### GET /admin/permissions

Get all permissions.

**Permission:** `admin.permissions.read`

### POST /admin/permissions

Create a new permission.

**Permission:** `admin.permissions.create`

**Request:**
```json
{
  "name": "custom.resource.action",
  "description": "Description of permission"
}
```

---

## Teams

### GET /admin/teams

Get all teams.

**Permission:** `admin.teams.read`

### GET /admin/teams/:id

Get team by ID with members.

**Permission:** `admin.teams.read`

### POST /admin/teams

Create a new team.

**Permission:** `admin.teams.create`

**Request:**
```json
{
  "name": "Engineering",
  "description": "Engineering team"
}
```

### PATCH /admin/teams/:id

Update team.

**Permission:** `admin.teams.update`

### DELETE /admin/teams/:id

Delete team.

**Permission:** `admin.teams.delete`

### POST /admin/teams/:teamId/members

Add member to team.

**Permission:** `admin.teams.add_member`

**Request:**
```json
{
  "userId": "uuid"
}
```

### DELETE /admin/teams/:teamId/members/:userId

Remove member from team.

**Permission:** `admin.teams.remove_member`

---

## Announcements

### GET /admin/announcements

Get all announcements.

**Permission:** `admin.announcements.read`

**Query Parameters:**
- `activeOnly=true` - Only return active announcements

### GET /admin/announcements/:id

Get announcement by ID.

**Permission:** `admin.announcements.read`

### POST /admin/announcements

Create announcement.

**Permission:** `admin.announcements.create`

**Request:**
```json
{
  "title": "Important Update",
  "content": "Please read this important announcement..."
}
```

### PATCH /admin/announcements/:id

Update announcement.

**Permission:** `admin.announcements.update`

**Request:**
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "isActive": false
}
```

### DELETE /admin/announcements/:id

Delete announcement.

**Permission:** `admin.announcements.delete`

---

## Audit Logs

### GET /admin/audit-logs

Get audit logs.

**Permission:** `admin.audit.read`

**Query Parameters:**
- `limit` (default: 50) - Number of logs to return
- `offset` (default: 0) - Pagination offset
- `userId` - Filter by user ID
- `action` - Filter by action
- `resourceType` - Filter by resource type

**Response:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "action": "admin.users.create",
      "resourceType": "user",
      "resourceId": "uuid",
      "userName": "Admin User",
      "userEmail": "admin@example.com",
      "ipAddress": "192.168.1.1",
      "details": {},
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0
}
```

---

## Error Responses

All endpoints may return the following error responses:

**401 Unauthorized:**
```json
{
  "error": "Access token required"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions",
  "required": "admin.users.create"
}
```

**400 Bad Request:**
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found"
}
```

**409 Conflict:**
```json
{
  "error": "Resource already exists"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

