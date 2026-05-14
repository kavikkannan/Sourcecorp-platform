# Authentication Flow

## Sequence Diagram

```mermaid
sequenceDiagram
    participant C as Browser Client
    participant F as Next.js Frontend
    participant B as Express Backend
    participant DB as PostgreSQL
    participant R as Redis

    %% Login
    C->>F: Enter email + password
    F->>B: POST /api/auth/login
    B->>DB: SELECT u.*, r.name as role FROM users u JOIN user_roles ur ...
    DB-->>B: User + roles
    B->>DB: SELECT p.name FROM permissions p JOIN role_permissions rp ...
    DB-->>B: Permission list
    B->>B: bcrypt.compare(password, hash)
    alt Invalid password
        B-->>F: 401 {error: "Invalid credentials"}
        F-->>C: Show error toast
    else Valid password
        B->>B: jwt.sign(accessToken, JWT_SECRET, {expiresIn: "24h"})
        B->>B: jwt.sign(refreshToken, JWT_REFRESH_SECRET, {expiresIn: "7d"})
        B->>R: SET refresh:userId refreshToken EX 7d
        B-->>F: 200 {accessToken, refreshToken, user}
        F->>F: localStorage.setItem("token", accessToken)
        F->>F: Set auth state
        F-->>C: Redirect to /dashboard
    end

    %% Authenticated Request
    C->>F: Click action (e.g., view cases)
    F->>B: GET /api/crm/cases<br/>Authorization: Bearer {accessToken}
    B->>B: jwt.verify(accessToken, JWT_SECRET)
    alt Token expired
        B-->>F: 401 {error: "Token expired"}
        F->>B: POST /api/auth/refresh (cookie: refreshToken)
        B->>R: GET refresh:userId
        R-->>B: storedRefreshToken
        B->>B: Compare tokens
        alt Valid refresh
            B->>B: Issue new accessToken
            B-->>F: 200 {accessToken}
            F->>F: Update token, retry request
        else Invalid refresh
            B-->>F: 401
            F->>F: Clear auth state
            F-->>C: Redirect to /login
        end
    else Token valid
        B->>B: Extract userId from payload
        B->>DB: SELECT permissions for user
        DB-->>B: Permission list
        B->>B: Check requiredPermission in list
        alt Permission denied
            B-->>F: 403 {error: "Insufficient permissions"}
            F-->>C: Show error toast
        else Permission granted
            B->>DB: Execute business query
            DB-->>B: Results
            B-->>F: 200 {data}
            F-->>C: Render data
        end
    end

    %% Logout
    C->>F: Click logout
    F->>B: POST /api/auth/logout<br/>Authorization: Bearer {token}
    B->>R: DEL refresh:userId
    B-->>F: 200 {message: "Logged out"}
    F->>F: localStorage.removeItem("token")
    F->>F: Clear auth state
    F-->>C: Redirect to /login
```

## JWT Token Structure

### Access Token
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "roles": ["admin"],
  "permissions": ["crm.case.view", "crm.case.create"],
  "iat": 1703001600,
  "exp": 1703088000
}
```

### Refresh Token
```json
{
  "userId": "uuid",
  "type": "refresh",
  "iat": 1703001600,
  "exp": 1703606400
}
```

## Middleware Chain

```
Request → helmet → cors → cookieParser → express.json → Route Handler
                                              ↓
                                    authenticateToken (JWT verify)
                                              ↓
                                    requirePermission (DB permission check)
                                              ↓
                                    validate (Zod schema validation)
                                              ↓
                                    Controller → Service → DB
```

## Permission Check Flow

```mermaid
graph TD
    A[Request arrives] --> B[authenticateToken]
    B --> C{Valid JWT?}
    C -->|No| D[401 Unauthorized]
    C -->|Yes| E[requirePermission]
    E --> F[Query DB: SELECT permissions WHERE user_id = ?]
    F --> G{Has permission?}
    G -->|No| H[403 Forbidden]
    G -->|Yes| I[Proceed to controller]
```

## Token Storage

| Token | Storage | Accessible By | Expiry |
|-------|---------|--------------|--------|
| Access Token | `localStorage` | JavaScript | 24h |
| Refresh Token | HTTP-only Cookie | Server only | 7d |

## Security Considerations

1. **Access token in localStorage**: Vulnerable to XSS. Mitigated by React's auto-escaping.
2. **Refresh token as HTTP-only cookie**: Protected from XSS, but needs CSRF protection.
3. **No CSRF token currently implemented**: Add Double Submit Cookie pattern for state-changing operations.
4. **Permission cache**: Currently fetched from DB on every request. Consider caching in Redis with invalidation on role changes.
