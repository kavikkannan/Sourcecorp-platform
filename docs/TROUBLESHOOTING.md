# Troubleshooting Guide

## Authentication Issues

### "Invalid credentials" on login
- Verify email exists in database
- Check password hash in `auth_schema.users`
- Ensure `bcrypt.compare()` uses same salt rounds as registration

### "Token expired" errors
- Access token expires after 24 hours
- Client should auto-refresh using refresh token endpoint
- If refresh fails, redirect to login

### "Insufficient permissions" after role change
- **Root cause**: JWT tokens cache permissions at login time
- **Fix**: Logout and log back in to regenerate JWT with updated claims
- **Future improvement**: Add token revocation/refresh endpoint

## Database Issues

### "Connection refused" to PostgreSQL
```bash
# Check if container is running
docker ps | grep postgres

# Check logs
docker logs sourcecorp-postgres

# Verify connection string in .env
DB_HOST=postgres
DB_PORT=5432
```

### Migration failures
```bash
# Check which migrations have run
SELECT * FROM migrations;

# Manual rollback (use with caution)
# Revert to backup, then re-run migrations
```

### Slow queries
```sql
-- Find slow queries (>500ms)
SELECT query, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

## Docker Issues

### Container fails to start
```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Port already in use
```bash
# Find process using port 3000/4000
netstat -ano | findstr :3000

# Kill process or change ports in docker-compose.yml
```

## Frontend Issues

### Blank page after build
- Check browser console for errors
- Verify API base URL is correct (`NEXT_PUBLIC_API_URL`)
- Check if auth token is valid

### "Module not found" errors
```bash
cd frontend
rm -rf node_modules
npm install
```

### Images not loading
- Verify image exists in uploads directory
- Check public routes are registered BEFORE auth middleware in `app.ts`
- Verify `src` attribute is correct (should hit `/api/recognitions/:id/image`)

## Backend Issues

### "Cannot find module" TypeScript errors
```bash
cd backend
npm run build
# Check tsc-errors.log for details
```

### File upload failures
- Check Multer limits (10MB max)
- Verify `memoryStorage` vs `diskStorage`
- Check file type filtering (images only)

### Memory leaks
- Monitor with `node --inspect`
- Check for unclosed database connections
- Review event listener leaks

## Redis Issues

### Connection errors
```bash
# Check Redis is running
docker ps | grep redis

# Test connection
redis-cli ping
# Expected: PONG
```

### BullMQ queue not processing
```bash
# Check queue status
redis-cli LRANGE bull:tasks:wait 0 -1

# Restart worker container
docker-compose restart backend
```

## Common Error Codes

| Error | Code | Resolution |
|-------|------|------------|
| Unauthorized | 401 | Refresh token or re-login |
| Forbidden | 403 | Check permissions, re-login |
| Not Found | 404 | Verify resource ID |
| Conflict | 409 | Unique constraint violation |
| Validation | 400 | Check request body against Zod schema |
| Internal Error | 500 | Check server logs |

## Health Check Commands

```bash
# Backend health
curl http://localhost:4000/health

# Database connectivity
curl http://localhost:4000/health/db

# Frontend build status
curl http://localhost:3000

# Full stack
docker-compose ps
```

## Log Locations

| Component | Location |
|-----------|----------|
| Backend logs | `backend/logs/` (Winston) |
| Frontend errors | Browser console |
| Database logs | `docker logs sourcecorp-postgres` |
| Nginx logs | `docker logs sourcecorp-nginx` |

## Emergency Contacts

- **DevOps**: [Your DevOps contact]
- **Database Admin**: [Your DBA contact]
- **Security**: [Your security contact]
