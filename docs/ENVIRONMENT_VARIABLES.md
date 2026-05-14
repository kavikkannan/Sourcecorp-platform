# Environment Variables Reference

## Backend Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode: `development`, `production`, `test` |
| `PORT` | No | `4000` | Express server port |
| `DB_HOST` | Yes | `localhost` | PostgreSQL hostname |
| `DB_PORT` | Yes | `5432` | PostgreSQL port |
| `DB_NAME` | Yes | `sourcecorp` | Database name |
| `DB_USER` | Yes | `postgres` | Database username |
| `DB_PASSWORD` | Yes | - | Database password |
| `REDIS_HOST` | Yes | `localhost` | Redis hostname |
| `REDIS_PORT` | Yes | `6379` | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password (if enabled) |
| `JWT_SECRET` | Yes | - | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | - | Secret for signing refresh tokens |
| `CORS_ORIGIN` | Yes | `http://localhost:3000` | Allowed CORS origin(s), comma-separated |

## Frontend Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:4000` | Backend API base URL |
| `NEXT_PUBLIC_APP_NAME` | No | `SourceCorp` | Application name for UI |

**Note**: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

## Security Notes

- `JWT_SECRET` and `JWT_REFRESH_SECRET` must be:
  - At least 32 characters long
  - Cryptographically random (use `openssl rand -hex 32`)
  - Different from each other
  - Never committed to version control

- `DB_PASSWORD` should be strong and unique per environment

## Docker Environment

### docker-compose.yml
```yaml
services:
  backend:
    environment:
      - NODE_ENV=production
      - PORT=4000
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=sourcecorp
      - DB_USER=postgres
      - DB_PASSWORD=${DB_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - CORS_ORIGIN=https://platform.sourcecorp.com
  
  frontend:
    environment:
      - NEXT_PUBLIC_API_URL=https://platform.sourcecorp.com/api
  
  postgres:
    environment:
      - POSTGRES_DB=sourcecorp
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${DB_PASSWORD}
  
  redis:
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
```

## Generating Secrets

```bash
# Generate JWT secrets
openssl rand -hex 32

# Generate database password
openssl rand -base64 24

# Generate Redis password (optional)
openssl rand -base64 16
```

## Environment Files

### Development
```bash
# backend/.env
NODE_ENV=development
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sourcecorp
DB_USER=postgres
DB_PASSWORD=dev_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_REFRESH_SECRET=dev_refresh_secret_change_in_production
CORS_ORIGIN=http://localhost:3000
```

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=SourceCorp
```

### Production
```bash
# backend/.env
NODE_ENV=production
PORT=4000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=sourcecorp
DB_USER=postgres
DB_PASSWORD=<strong_password>
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<redis_password>
JWT_SECRET=<32_char_random>
JWT_REFRESH_SECRET=<32_char_random_different>
CORS_ORIGIN=https://platform.sourcecorp.com
```

## Validation

The backend validates required variables on startup:
```typescript
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
```

## Checking Current Values

```bash
# Backend
cd backend && cat .env

# Frontend
cd frontend && cat .env.local

# Docker Compose
docker-compose config
```
