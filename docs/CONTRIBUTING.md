# Contributing Guide

## Getting Started

### Prerequisites
- Node.js 18+
- Docker + Docker Compose
- Git

### Setup
```bash
# Clone repository
git clone <repository-url>
cd sourcecorp-platform

# Start infrastructure
docker-compose up -d postgres redis

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

## Development Workflow

### Running Locally
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Database (if not using Docker)
# Ensure PostgreSQL and Redis are running
```

### Database Migrations
```bash
cd backend

# Create a new migration
npx ts-node src/migrations/create-migration.ts <migration-name>

# Run migrations
npx ts-node src/migrations/run-migrations.ts

# Rollback last migration
npx ts-node src/migrations/rollback-migration.ts
```

## Code Style

### TypeScript
- Use strict mode (`strict: true` in tsconfig.json)
- Avoid `any` type - use `unknown` with type guards
- Prefer interfaces over types for object shapes
- Use explicit return types on exported functions

### Naming Conventions
| Item | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserCard.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| Services | camelCase | `userService.ts` |
| Utilities | camelCase | `formatDate.ts` |
| Constants | UPPER_SNAKE_CASE | `API_BASE_URL` |
| Database tables | snake_case | `user_roles` |
| API endpoints | kebab-case | `/api/user-roles` |

### File Organization
```
feature/
├── components/       # React components
├── hooks/           # Custom hooks
├── services/        # API calls
├── types/           # TypeScript types
├── utils/           # Helper functions
└── index.ts         # Public exports
```

## Git Workflow

### Branch Naming
```
feature/case-status-filtering
bugfix/login-redirect-loop
hotfix/security-patch
refactor/template-builder
```

### Commit Messages
Follow conventional commits:
```
feat(crm): add HOLD status to case workflow
fix(auth): resolve token refresh race condition
docs(api): update endpoint documentation
refactor(templates): simplify validation logic
test(finance): add CAM entry tests
```

### Pull Request Process
1. Create feature branch from `main`
2. Make changes with descriptive commits
3. Ensure code compiles (`npm run build`)
4. Update documentation if needed
5. Create PR with description of changes
6. Request review from team member
7. Merge after approval

## Testing

### Before Submitting
- [ ] Code compiles without errors (`tsc --noEmit`)
- [ ] No console errors in browser
- [ ] Tested on main user flows
- [ ] Responsive on mobile viewport

### Manual Testing Checklist
- [ ] Login/logout works
- [ ] CRUD operations on primary entities
- [ ] Permission checks work correctly
- [ ] File uploads function properly
- [ ] Toast notifications appear

## Database Guidelines

### Schema Changes
1. Always create a migration file
2. Include rollback logic
3. Test migration on fresh database
4. Document breaking changes

### New Tables
- Use UUID primary keys (`gen_random_uuid()`)
- Add `created_at` and `updated_at` timestamps
- Create indexes on foreign keys
- Add to appropriate schema (auth, crm, finance, etc.)

## Frontend Guidelines

### Component Structure
```typescript
// Imports
import React from 'react';

// Types
interface Props {
  title: string;
}

// Component
export function MyComponent({ title }: Props) {
  // hooks
  // handlers
  // render
  return <div>{title}</div>;
}
```

### Styling
- Use Tailwind CSS utility classes
- Prefer composition over custom CSS
- Use `cn()` utility for conditional classes
- Dark mode: use `dark:` prefix

### State Management
- Local state: `useState`, `useReducer`
- Server state: React Query (if added)
- Global state: Context API (AuthContext)
- Avoid prop drilling beyond 2 levels

## API Guidelines

### Endpoint Design
- RESTful resource naming
- Version in URL: `/api/v1/...` (future)
- Consistent response format:
```json
{
  "data": {},
  "message": "optional message",
  "error": "error description"
}
```

### Error Handling
- Use appropriate HTTP status codes
- Include descriptive error messages
- Log server errors with Winston
- Don't expose internal details to client

## Documentation

Update relevant docs when changing:
- API endpoints → `API.md`
- Database schema → `DATABASE.md`
- Environment variables → `ENVIRONMENT_VARIABLES.md`
- New features → `FEATURES.md`
- Architecture changes → `ARCHITECTURE.md`

## Code Review

### Reviewer Checklist
- [ ] Code follows style guide
- [ ] No security vulnerabilities
- [ ] Error handling is adequate
- [ ] No unnecessary dependencies
- [ ] Performance considerations addressed
- [ ] Documentation updated

### Author Checklist
- [ ] Self-reviewed before requesting
- [ ] Explained complex logic with comments
- [ ] Linked related issues
- [ ] Added screenshots for UI changes
- [ ] Tested edge cases

## Questions?

Contact the maintainers or open an issue for clarification.
