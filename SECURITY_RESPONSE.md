# Security Response - Malicious File Detection

## Incident Summary
- **Date**: Detected by Hostinger in last 30 days
- **File Path**: `/var/lib/docker/overlay2/.../diff/tmp/.x/m`
- **Status**: File no longer exists (likely cleaned by Hostinger or temporary)

## Immediate Actions Taken

### 1. System Scan
- ✅ Checked all running containers
- ✅ Verified file no longer exists
- ✅ Reviewed shell scripts for suspicious content
- ✅ Checked network connections (only expected services running)

### 2. Container Status
- **sourcecorp-backend**: Running (healthy)
- **sourcecorp-postgres**: Running (healthy)
- **sourcecorp-redis**: Running (healthy)

## Security Recommendations

### 1. Immediate Actions

#### A. Change All Passwords
```bash
# Change database password
docker compose exec postgres psql -U sourcecorp_user -d sourcecorp -c "ALTER USER sourcecorp_user WITH PASSWORD 'NEW_STRONG_PASSWORD';"

# Update .env file with new password
# Regenerate JWT secrets
```

#### B. Review User Accounts
```bash
# Check all users in database
docker compose exec postgres psql -U sourcecorp_user -d sourcecorp -c "SELECT id, email, first_name, last_name, created_at FROM auth_schema.users ORDER BY created_at DESC;"

# Check for suspicious recent logins
docker compose exec postgres psql -U sourcecorp_user -d sourcecorp -c "SELECT * FROM audit_schema.audit_logs WHERE created_at > NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 50;"
```

#### C. Review Error Logs
```bash
# Check error logs for suspicious activity
docker compose exec postgres psql -U sourcecorp_user -d sourcecorp -c "SELECT * FROM audit_schema.error_logs WHERE created_at > NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 50;"
```

### 2. Security Hardening

#### A. Update Docker Images
```bash
# Pull latest images
docker compose pull

# Rebuild containers
docker compose down
docker compose up -d --build
```

#### B. Review File Permissions
```bash
# Ensure proper permissions on scripts
chmod 755 scripts/*.sh
chmod 600 .env

# Review uploads directory
ls -la uploads/
```

#### C. Enable Firewall Rules
```bash
# Only allow necessary ports
# - 80/443 for web traffic
# - 22 for SSH (if needed)
# Block all other ports
```

### 3. Monitoring & Prevention

#### A. Set Up Log Monitoring
- Monitor audit logs regularly
- Set up alerts for suspicious activity
- Review error logs daily

#### B. Regular Security Scans
```bash
# Scan for suspicious files weekly
find /var/lib/docker/overlay2 -type f -name "*.sh" -o -name "*.py" -o -name ".x" 2>/dev/null

# Check for unauthorized processes
docker exec sourcecorp-backend ps aux
```

#### C. Backup Strategy
- Ensure regular backups are running
- Test backup restoration
- Store backups securely

### 4. Code Review

#### Review Recent Changes
```bash
# Check git history for suspicious commits
git log --since="30 days ago" --all --stat

# Review any files modified in last 30 days
git log --since="30 days ago" --name-only --pretty=format: | sort -u
```

### 5. Access Control

#### A. Review SSH Access
- Disable root login
- Use key-based authentication only
- Review authorized_keys files

#### B. Database Access
- Ensure database is not exposed to public internet
- Use strong passwords
- Limit database user permissions

#### C. Application Security
- Review API endpoints for vulnerabilities
- Ensure input validation on all endpoints
- Review file upload functionality

## Prevention Checklist

- [ ] Change all passwords (DB, JWT secrets)
- [ ] Review all user accounts
- [ ] Check audit logs for suspicious activity
- [ ] Update Docker images
- [ ] Review file permissions
- [ ] Enable firewall rules
- [ ] Set up log monitoring
- [ ] Review recent code changes
- [ ] Check SSH access logs
- [ ] Review API security
- [ ] Update dependencies
- [ ] Set up automated security scans

## Next Steps

1. **Immediate**: Change all passwords and secrets
2. **Today**: Review audit logs and user accounts
3. **This Week**: Update all images and dependencies
4. **Ongoing**: Set up monitoring and regular scans

## Contact

If you find any suspicious activity:
1. Document the finding
2. Take screenshots/logs
3. Isolate affected systems if necessary
4. Contact Hostinger support for assistance
