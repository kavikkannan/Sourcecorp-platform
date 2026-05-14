# SourceCorp Platform - Quick Setup Guide

## One-Command Setup

For the fastest setup, run:

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Start the platform
bash scripts/start.sh

# Create admin user
bash scripts/setup-admin.sh
```

Then access the platform at **http://localhost**

---

## Manual Setup (Step by Step)

### 1. Prerequisites

Ensure you have installed:
- **Docker** (version 20.x or higher)
- **Docker Compose** (version 2.x or higher)

Verify installation:
```bash
docker --version
docker-compose --version
```

### 2. Clone or Navigate to Project

```bash
cd sourcecorp-platform
```

### 3. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` and set secure values, or generate them:

```bash
# Generate secure database password
openssl rand -base64 32 | tr -d "=+/" | cut -c1-25

# Generate JWT secret
openssl rand -base64 32

# Generate refresh token secret
openssl rand -base64 32
```

Example `.env`:
```env
DB_PASSWORD=YourSecurePasswordHere123
JWT_SECRET=your_jwt_secret_key_minimum_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_minimum_32_chars
```

### 4. Start All Services

```bash
docker-compose up -d
```

This starts:
- ✅ PostgreSQL database (internal only)
- ✅ Redis cache (internal only)
- ✅ Backend API (internal only)
- ✅ Frontend (internal only)
- ✅ Nginx reverse proxy (exposed on port 80)

### 5. Wait for Services

Wait ~30 seconds for all services to initialize:
```bash
docker-compose ps
```

All services should show "Up" and "healthy".

### 6. Run Database Migrations

```bash
docker-compose exec backend npm run migrate
```

This creates:
- `auth_schema` - Users, roles, permissions, teams
- `admin_schema` - Announcements
- `audit_schema` - Audit logs

### 7. Create Admin User

**Option A: Using the setup script (Recommended)**

```bash
bash scripts/setup-admin.sh
```

Follow the prompts to enter:
- Admin email
- Admin password
- First name
- Last name

**Option B: Manual SQL**

Generate password hash:
```bash
docker-compose exec backend node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword123', 10));"
```

Connect to database:
```bash
docker-compose exec postgres psql -U sourcecorp_user -d sourcecorp
```

Run setup SQL (see [README.md](../README.md) for full SQL script).

### 8. Access the Platform

Open your browser:
```
http://localhost
```

Login with your admin credentials.

---

## Verify Installation

### Check Service Health

```bash
# View all services
docker-compose ps

# Check backend health
curl http://localhost/health

# View backend logs
docker-compose logs -f backend

# View all logs
docker-compose logs -f
```

### Test Login

1. Navigate to `http://localhost`
2. Enter admin email and password
3. You should be redirected to the dashboard
4. Verify sidebar shows all admin sections

### Test Admin Functions

1. **Users**: Create a test user
2. **Roles**: Create a test role
3. **Permissions**: View permissions list
4. **Teams**: Create a test team
5. **Announcements**: Post a test announcement
6. **Audit Logs**: Verify all actions are logged

---

## Common Issues

### Services not starting

```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart

# Full reset
docker-compose down -v
docker-compose up -d
```

### Cannot access localhost

- Ensure port 80 is not in use by another service
- Check nginx logs: `docker-compose logs nginx`
- Verify nginx is running: `docker-compose ps nginx`

### Migration fails

```bash
# Check postgres logs
docker-compose logs postgres

# Verify postgres is ready
docker-compose exec postgres pg_isready -U sourcecorp_user

# Try migration again
docker-compose exec backend npm run migrate
```

### Login fails

- Verify user was created: 
  ```bash
  docker-compose exec postgres psql -U sourcecorp_user -d sourcecorp -c "SELECT email FROM auth_schema.users;"
  ```
- Check backend logs for errors: `docker-compose logs backend`
- Ensure password hash was generated correctly

### "Access Denied" after login

- Verify user has admin role:
  ```bash
  docker-compose exec postgres psql -U sourcecorp_user -d sourcecorp -c "
  SELECT u.email, r.name 
  FROM auth_schema.users u
  JOIN auth_schema.user_roles ur ON u.id = ur.user_id
  JOIN auth_schema.roles r ON ur.role_id = r.id;"
  ```
- Verify admin role has permissions
- Run setup-admin.sh script again

---

## Production Deployment

Before deploying to production:

1. **Change default credentials**
   - Use strong, unique passwords
   - Generate new JWT secrets

2. **Enable HTTPS**
   - Configure SSL certificates in nginx
   - Update CORS_ORIGIN in docker-compose.yml

3. **Secure the database**
   - Use strong DB password
   - Regular backups
   - Consider managed database service

4. **Environment variables**
   - Use secrets management (Docker secrets, Vault, etc.)
   - Never commit `.env` to git

5. **Monitoring**
   - Set up log aggregation
   - Configure alerts
   - Monitor resource usage

6. **Backups**
   - Automated daily database backups
   - Test restore procedures
   - Store backups securely

7. **Network security**
   - Configure firewall rules
   - Use private networks
   - Implement rate limiting

---

## Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Database Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U sourcecorp_user sourcecorp > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose exec -T postgres psql -U sourcecorp_user sourcecorp < backup_20240101_120000.sql
```

### Update Services

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose up -d --build

# Run any new migrations
docker-compose exec backend npm run migrate
```

### Stop Services

```bash
# Stop (preserves data)
docker-compose down

# Stop and remove all data
docker-compose down -v
```

---

## Support

For additional help:
1. Check [README.md](../README.md) for detailed information
2. View Docker logs for error messages
3. Verify all prerequisites are met
4. Contact the development team

---

## Next Steps After Setup

Once the platform is running:

1. **Create additional users** via the Users page
2. **Define custom roles** for different access levels
3. **Create permissions** for new features
4. **Organize teams** and assign members
5. **Post announcements** to communicate with users
6. **Monitor audit logs** for security and compliance

Phase 1 is now complete! 🎉

