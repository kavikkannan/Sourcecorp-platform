# Changelog Summary

## Overview

This document summarizes major changes and releases for the SourceCorp Platform.

---

## Phase 1: Foundation

**Status**: Complete

### Features
- Authentication system (JWT + refresh tokens)
- Role-based access control (RBAC)
- User management (CRUD)
- Role and permission management
- Basic dashboard

---

## Phase 2: CRM Module

**Status**: Complete (see `PHASE2_COMPLETE.md`)

### Features
- Case management (create, read, update)
- Case status tracking (`NEW`, `IN_PROGRESS`, `PENDING`, `COMPLETED`)
- Case assignment to users
- Case notes and documents
- Customer detail sheets
- Notifications

### Technical
- PostgreSQL multi-schema design
- Audit logging
- File upload support

---

## Phase 3: Financial Tools

**Status**: Complete

### Features
- CAM (Credit Appraisal Memorandum) templates and entries
- Obligation sheet templates and entries
- Eligibility calculator
- Template builder with drag-and-drop
- Section-based field grouping
- Validation rules (min, max, pattern)

### Technical
- Dynamic form generation from templates
- Version history for CAM entries
- Donut chart for obligation visualization

---

## Phase 4: Task Management

**Status**: Complete (see `PHASE4_COMPLETE.md`)

### Features
- Task creation and assignment
- Task status workflow
- Hierarchical task assignment (upward/downward)
- Task notifications

### Technical
- Database triggers for hierarchy validation
- BullMQ for background job processing

---

## Phase 5: Admin & UX Enhancements

**Status**: Complete (see `PHASE5_COMPLETE.md`)

### Features
- Announcements with image uploads
- Recognitions (Monthly Achiever, Best Employee)
- Audit log viewer
- Admin dashboard
- Team management
- Customer detail templates

### UX Improvements
- Toast notifications (Sonner)
- Debounced search
- Drag-and-drop reordering (@dnd-kit)
- Preview mode for templates
- Clone/duplicate templates
- Collapsible sections
- Auto-save drafts to localStorage
- Recent case chips
- Empty states with CTAs

---

## Hierarchy Upgrade (Reverted)

**Status**: Reverted

### Originally Added
- Recursive CTE for subordinate queries
- Manager transfer with history tracking
- Batch manager assignment
- CSS org chart with connecting lines
- Hierarchy history table
- CSV export for hierarchy

### Reverted Because
- Complexity outweighed benefits
- Performance issues with recursive queries
- CRM integration caused filtering bugs
- UI complexity for end users

### Current State
- Basic hierarchy: manager-subordinate direct relationship only
- `assignManager`, `removeManager`, `getHierarchyTree`
- No recursive queries, no history table

---

## Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| JWT permission caching | Known | Re-login after role changes |
| Table component typing | Known | Cast columns `as any` |
| Git state mismatch | Known | Use `git reflog` to recover |

## Migration Notes

### Obligation Sections Migration
```bash
cd backend
npx ts-node src/migrations/migrate-obligation-sections.ts
```

### Hierarchy Reset
No migration needed. Reverted to original schema.

## Future Roadmap

| Feature | Priority |
|---------|----------|
| Automated testing suite | High |
| API response caching | High |
| File storage (S3/MinIO) | Medium |
| Reporting and analytics | Medium |
| Mobile responsiveness | Medium |
| WebSocket real-time updates | Low |
| Multi-tenancy support | Low |
