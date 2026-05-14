# Folder Structure

```
souercecorp-platform/
├── backend/
│   ├── src/
│   │   ├── app.ts                          # Express app factory
│   │   ├── index.ts                        # Server bootstrap (DB, Redis, HTTP)
│   │   ├── config/
│   │   │   ├── env.ts                      # Environment variable config
│   │   │   └── logger.ts                   # Winston logger setup
│   │   ├── controllers/                    # HTTP request handlers
│   │   │   ├── announcements.controller.ts
│   │   │   ├── audit.controller.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── crm.controller.ts
│   │   │   ├── finance.controller.ts
│   │   │   ├── hierarchy.controller.ts
│   │   │   ├── note.controller.ts
│   │   │   ├── permissions.controller.ts
│   │   │   ├── recognitions.controller.ts
│   │   │   ├── roles.controller.ts
│   │   │   ├── task.controller.ts
│   │   │   ├── teams.controller.ts
│   │   │   ├── template.controller.ts
│   │   │   └── users.controller.ts
│   │   ├── services/                       # Business logic layer
│   │   │   ├── audit.service.ts
│   │   │   ├── crm.service.ts
│   │   │   ├── export.service.ts
│   │   │   ├── finance.service.ts
│   │   │   ├── hierarchy.service.ts
│   │   │   ├── note.service.ts
│   │   │   ├── queue.service.ts
│   │   │   ├── task.service.ts
│   │   │   ├── template-validation.service.ts
│   │   │   └── template.service.ts
│   │   ├── routes/                         # Route definitions
│   │   │   ├── admin.routes.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── crm.routes.ts
│   │   │   ├── finance.routes.ts
│   │   │   ├── notes.routes.ts
│   │   │   ├── tasks.routes.ts
│   │   │   ├── template.routes.ts
│   │   │   └── users.routes.ts
│   │   ├── middleware/                     # Express middleware
│   │   │   ├── auth.middleware.ts          # JWT verification
│   │   │   ├── error.middleware.ts         # Global error handler
│   │   │   ├── rbac.middleware.ts          # Permission checks
│   │   │   └── validate.middleware.ts      # Zod validation
│   │   ├── validators/                     # Zod schemas
│   │   │   ├── admin.validator.ts
│   │   │   ├── auth.validator.ts
│   │   │   ├── chat.validator.ts
│   │   │   ├── crm.validator.ts
│   │   │   ├── finance.validator.ts
│   │   │   └── template.validator.ts
│   │   ├── db/                             # Database layer
│   │   │   ├── pool.ts                     # pg Pool setup
│   │   │   ├── redis.ts                    # ioredis client
│   │   │   ├── schema.sql                  # Full DDL schema
│   │   │   ├── migrations/                 # SQL migration files
│   │   │   └── migrate-*.ts                # TypeScript migration runners
│   │   ├── types/
│   │   │   └── index.ts                    # Shared TypeScript interfaces
│   │   ├── workers/
│   │   │   └── export.worker.ts            # BullMQ export processor
│   │   ├── utils/
│   │   │   └── jwt.ts                      # JWT helpers
│   │   └── assets/
│   │       └── logo.png
│   ├── package.json
│   ├── Dockerfile
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                  # Root layout (AuthProvider)
│   │   │   ├── globals.css
│   │   │   ├── page.tsx                    # Maintenance page
│   │   │   ├── login/
│   │   │   │   └── page.tsx                # Login page
│   │   │   └── (protected)/                # Route group (auth required)
│   │   │       ├── layout.tsx              # Protected layout (Sidebar)
│   │   │       ├── dashboard/
│   │   │       │   └── page.tsx
│   │   │       ├── announcements/
│   │   │       │   └── page.tsx
│   │   │       ├── crm/
│   │   │       │   ├── cases/
│   │   │       │   │   ├── page.tsx
│   │   │       │   │   └── [id]/
│   │   │       │   │       └── page.tsx
│   │   │       │   └── notifications/
│   │   │       │       └── page.tsx
│   │   │       ├── financial-tools/
│   │   │       │   ├── cam/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── obligation/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── eligibility/
│   │   │       │       └── page.tsx
│   │   │       ├── tasks/
│   │   │       │   ├── page.tsx
│   │   │       │   └── hierarchy/
│   │   │       │       └── page.tsx
│   │   │       ├── notes/
│   │   │       │   └── page.tsx
│   │   │       ├── chat/
│   │   │       │   └── page.tsx
│   │   │       └── admin/
│   │   │           ├── users/
│   │   │           │   └── page.tsx
│   │   │           ├── roles/
│   │   │           │   └── page.tsx
│   │   │           ├── teams/
│   │   │           │   └── page.tsx
│   │   │           ├── hierarchy/
│   │   │           │   └── page.tsx
│   │   │           ├── announcements/
│   │   │           │   └── page.tsx
│   │   │           ├── recognitions/
│   │   │           │   └── page.tsx
│   │   │           ├── audit-logs/
│   │   │           │   └── page.tsx
│   │   │           └── templates/
│   │   │               ├── cam/
│   │   │               │   └── page.tsx
│   │   │               ├── obligation/
│   │   │               │   └── page.tsx
│   │   │               └── customer-detail/
│   │   │                   └── page.tsx
│   │   ├── components/                     # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── FinancialToolsNav.tsx
│   │   │   ├── ToastProvider.tsx
│   │   │   └── DonutChart.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx             # Auth state + permission checks
│   │   ├── hooks/
│   │   │   └── useDebounce.ts
│   │   ├── lib/                            # API clients & type definitions
│   │   │   ├── api.ts                      # Axios instance
│   │   │   ├── auth.ts                     # Auth API
│   │   │   ├── crm.ts                      # CRM API + types
│   │   │   ├── finance.ts                  # Finance API + types
│   │   │   ├── tasks.ts                    # Tasks API + types
│   │   │   ├── templates.ts               # Template API
│   │   │   ├── hierarchy.ts               # Hierarchy API
│   │   │   ├── notes.ts                   # Notes API
│   │   │   └── chat.ts                    # Chat API
│   │   └── utils/
│   │       ├── errorHandler.ts
│   │       ├── formatNumber.ts
│   │       └── downloadBlob.ts
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       └── default.conf
│
├── scripts/
│   ├── setup-admin.ps1
│   ├── setup-crm.sh
│   ├── migrate-hierarchy.sh
│   └── start.sh
│
├── docs/                                   # Documentation
├── docker-compose.txt
├── README.md
└── .gitignore
```

## Naming Conventions

| Location | Pattern | Example |
|----------|---------|---------|
| Backend controllers | `PascalCaseController.ts` | `CRMController.ts` |
| Backend services | `PascalCaseService.ts` | `CRMService.ts` |
| Backend routes | `kebab-case.routes.ts` | `crm.routes.ts` |
| Backend validators | `camelCaseSchema` | `createCaseSchema` |
| Frontend pages | `page.tsx` in route folder | `app/crm/cases/page.tsx` |
| Frontend components | `PascalCase.tsx` | `PageHeader.tsx` |
| Frontend libs | `camelCase.ts` | `crm.ts` |
| API endpoints | `kebab-case` | `/api/crm/cases` |
| DB tables | `snake_case` | `case_assignments` |
| DB schemas | `snake_case_schema` | `crm_schema` |
