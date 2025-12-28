# SourceCorp Platform - Phase 1

Production-grade internal platform with admin control plane.

## Architecture

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Reverse Proxy**: Nginx
- **Infrastructure**: Docker Compose

## Features (Phase 1)

### Admin Control Plane
- ✅ User Management (Create, Edit, Deactivate)
- ✅ Role & Permission Management (RBAC)
- ✅ Team Management
- ✅ Announcements
- ✅ Audit Logs (All write operations tracked)
- ✅ JWT Authentication with Refresh Tokens
- ✅ Role-Based Access Control (API-level enforcement)

### Security
- All admin APIs protected by RBAC
- JWT access tokens (15min expiry) + Refresh tokens (7 days)
- Permission-based route guards
- Audit logging for all administrative actions
- No exposed database ports
- Internal Docker network

## Prerequisites

- Docker
- Docker Compose
- Git

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/kavikkannan/Sourcecorp-platform.git
cd sourcecorp-platform
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and set secure values:

```env
DB_PASSWORD=<strong-postgres-password>
JWT_SECRET=<32+-character-secret>
JWT_REFRESH_SECRET=<32+-character-secret>
```

**Generate secure secrets:**
```bash
openssl rand -base64 32
```

### 3. Start the Platform

```bash
docker-compose up -d
```

This will start all services:
- PostgreSQL (internal only)
- Redis (internal only)
- Backend API (internal only)
- Frontend (internal only)
- Nginx (exposed on port 80)

### 4. Run Database Migrations

```bash
docker-compose exec backend npm run migrate
```

This creates all required schemas and tables:
- `auth_schema` (users, roles, permissions, teams)
- `admin_schema` (announcements)
- `audit_schema` (audit logs)

### 5. Create First Admin User

Connect to the database:
```bash
docker-compose exec postgres psql -U sourcecorp_user -d sourcecorp
```

Run the following SQL to create an admin user:

```sql
-- Create user
INSERT INTO auth_schema.users (email, password_hash, first_name, last_name)
VALUES (
  'admin@sourcecorp.com',
  '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', -- See note below
  'Admin',
  'User'
);

-- Create admin role
INSERT INTO auth_schema.roles (name, description)
VALUES ('Admin', 'System Administrator');

-- Create permissions
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
('admin.audit.read', 'View audit logs');

-- Assign all permissions to admin role
INSERT INTO auth_schema.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM auth_schema.roles r, auth_schema.permissions p
WHERE r.name = 'Admin';

-- Assign admin role to user
INSERT INTO auth_schema.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth_schema.users u, auth_schema.roles r
WHERE u.email = 'admin@sourcecorp.com' AND r.name = 'Admin';
```

**To generate password hash for the admin user:**

```bash
docker-compose exec backend node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123', 10));"
```

Replace the hash in the SQL above.

### 6. Access the Platform

Open your browser and navigate to:
```
http://localhost
```

Login with:
- Email: `admin@sourcecorp.com`
- Password: `YourPassword123` (or whatever you set)

## Available Routes

### Public
- `/login` - Login page

### Protected (Admin)
- `/dashboard` - Dashboard
- `/admin/users` - User management
- `/admin/roles` - Role management
- `/admin/teams` - Team management
- `/admin/announcements` - Announcements
- `/admin/audit-logs` - Audit logs (read-only)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user info

### Admin (All require authentication + permissions)
- **Users**: `/api/admin/users`
- **Roles**: `/api/admin/roles`
- **Permissions**: `/api/admin/permissions`
- **Teams**: `/api/admin/teams`
- **Announcements**: `/api/admin/announcements`
- **Audit Logs**: `/api/admin/audit-logs`

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

- **[Setup Guide](./docs/SETUP_GUIDE.md)** - Detailed setup instructions
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and architecture
- **[API Reference](./docs/API.md)** - Complete API documentation
- **[Permissions Guide](./docs/PERMISSIONS.md)** - RBAC permissions reference
- **[Phase 1 Report](./docs/PHASE1_COMPLETE.md)** - Completion verification

See [docs/README.md](./docs/README.md) for the complete documentation index.

## Development

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

## Monitoring

### Check Service Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
```

### Health Checks
- Backend: `http://localhost/api/health`
- Overall: `http://localhost/health`

## Database Backup

```bash
docker-compose exec postgres pg_dump -U sourcecorp_user sourcecorp > backup.sql
```

## Database Restore

```bash
docker-compose exec -T postgres psql -U sourcecorp_user sourcecorp < backup.sql
```

## Stop Platform

```bash
docker-compose down
```

## Stop and Remove All Data

```bash
docker-compose down -v
```

## Production Deployment Checklist

- [ ] Change all default passwords and secrets
- [ ] Use environment-specific `.env` files
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set up monitoring and alerting
- [ ] Review and harden security settings
- [ ] Use Docker secrets for sensitive data
- [ ] Implement rate limiting
- [ ] Configure CORS properly
- [ ] Set up CI/CD pipeline

## Architecture Decisions

### No Mock Data
- System starts empty
- First admin must be created via SQL
- All subsequent users created through UI

### RBAC Enforcement
- All permission checks at API level
- Frontend role checks are for UX only
- Permission format: `resource.action` (e.g., `admin.users.create`)

### Audit Logging
- All write operations logged automatically
- Includes user, action, resource, IP, timestamp
- Read-only access for admins

### Database Isolation
- PostgreSQL and Redis not exposed externally
- Only accessible via Docker network
- All external access through nginx

## Troubleshooting

### Cannot connect to database
```bash
docker-compose logs postgres
docker-compose exec postgres pg_isready -U sourcecorp_user
```

### Backend not starting
```bash
docker-compose logs backend
```

### Permission denied errors
Ensure user has proper role and permissions assigned.

### Forgot admin password
Connect to database and update password hash:
```sql
UPDATE auth_schema.users 
SET password_hash = '<new-hash>' 
WHERE email = 'admin@sourcecorp.com';
```

## Support

For issues or questions, contact the development team.

## License

Proprietary - Internal Use Only
