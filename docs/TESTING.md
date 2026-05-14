# Testing Guide

## Current Testing Status

| Type | Framework | Coverage | Status |
|------|-----------|----------|--------|
| Unit Tests | None | 0% | Not implemented |
| Integration Tests | None | 0% | Not implemented |
| E2E Tests | None | 0% | Not implemented |
| Manual Testing | Human | Ad-hoc | Ongoing |

## Testing Philosophy

**Given the platform's critical financial nature, testing should be the next major investment.**

Priority order:
1. **Backend API integration tests** (highest ROI)
2. **Frontend component tests** (UI stability)
3. **End-to-end critical paths** (user journeys)
4. **Unit tests for utilities** (regression prevention)

## Recommended Setup

### Backend: Jest + Supertest

```bash
cd backend
npm install --save-dev jest @types/jest supertest @types/supertest
```

```typescript
// backend/src/__tests__/auth.test.ts
import request from 'supertest';
import app from '../app';

describe('Auth Endpoints', () => {
  it('POST /api/auth/login - valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password' });
    
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('POST /api/auth/login - invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'wrong' });
    
    expect(res.status).toBe(401);
  });
});
```

### Frontend: Vitest + React Testing Library

```bash
cd frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// frontend/src/__tests__/LoginForm.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '../components/LoginForm';

it('shows error on empty submit', async () => {
  render(<LoginForm />);
  fireEvent.click(screen.getByText('Login'));
  expect(await screen.findByText('Email is required')).toBeInTheDocument();
});
```

### E2E: Playwright

```bash
npm install --save-dev @playwright/test
npx playwright install
```

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('user can login and view dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name=email]', 'admin@test.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/dashboard');
});
```

## Critical Paths to Test

### Authentication
- [ ] Login with valid/invalid credentials
- [ ] Token refresh on expiry
- [ ] Logout clears session
- [ ] Access protected route without auth (redirect)

### CRM
- [ ] Create case
- [ ] Update case status
- [ ] Assign case to user
- [ ] Search/filter cases

### Financial Tools
- [ ] Create CAM entry
- [ ] Create obligation sheet
- [ ] Template validation rules enforce correctly
- [ ] Export to PDF/Excel

### Admin
- [ ] CRUD users
- [ ] CRUD roles/permissions
- [ ] Upload announcement image
- [ ] Create recognition

### Tasks
- [ ] Create task
- [ ] Update task status (hierarchy validation)
- [ ] Assign task (upward/downward rules)

## Test Data Strategy

```typescript
// backend/src/__tests__/setup.ts
import { query } from '../db';

beforeAll(async () => {
  await query('BEGIN');
  // Seed test data
});

afterAll(async () => {
  await query('ROLLBACK');
});
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd backend && npm ci && npm test
      
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd frontend && npm ci && npm test
```

## Coverage Targets

| Layer | Target | Critical Files |
|-------|--------|----------------|
| API Controllers | 80% | All route handlers |
| Services | 90% | Business logic |
| Utilities | 70% | Validation, formatting |
| Frontend Components | 60% | Forms, tables, modals |

## Manual Testing Checklist

### Before Each Release
- [ ] Login/logout flow
- [ ] Create and edit a CRM case
- [ ] Submit CAM entry
- [ ] Submit obligation sheet
- [ ] Create and assign a task
- [ ] Upload and view announcement
- [ ] Check audit logs
- [ ] Verify role-based access control
- [ ] Test on mobile viewport
- [ ] Test with slow network (3G)
