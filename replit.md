# Business Automation SaaS

## Overview

A full-stack multi-tenant SaaS platform for business automation. Features role-based access control with 4 user roles, 20 frontend pages, 20 API route modules, and 20+ database tables covering the full spectrum of business operations.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/business-automation) — mounted at `/`
- **API framework**: Express 5 (artifacts/api-server) — mounted at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (bcryptjs + jsonwebtoken)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec) + direct `apiFetch()` for extended routes
- **Build**: esbuild (CJS bundle)

## User Roles

- `super_admin` — Full access including tenant/org management, billing overview
- `org_admin` — Manages their organization: users, departments, projects, marketing, finance, clients, bills
- `department_head` — Manages their department: users, attendance, projects, clients, inventory
- `employee` — View own attendance, projects, calendar, documents

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@demo.com | password |
| Org Admin | orgadmin@demo.com | password |
| Department Head | depthead@demo.com | password |
| Employee | employee@demo.com | password |

## Pages (20 total)

### Core
1. `/login` — JWT auth login, demo account quick-fill buttons
2. `/dashboard` — Role-specific stats, charts, recent activity

### HR & People
3. `/organizations` — Multi-tenant org management (Super Admin only)
4. `/users` — User management with employee codes, roles, departments
5. `/departments` — Department management with heads
6. `/attendance` — Daily check-in/out tracking

### Work
7. `/projects` — Project management: cards grid, detail sheet with tasks+attachments+approval workflow
8. `/calendar` — Calendar with events, meetings, holidays; add/delete events
9. `/documents` — Document library with approval workflow, categories, tags

### Business
10. `/clients` — CRM: Full client management — stat cards, search/filter, table with CL-codes; Add/Edit modal (company, GST, WhatsApp, state/city); Client Profile Sheet with 4 tabs: Overview (contact details), Interactions (call/email/meeting/whatsapp/followup log with follow-up dates), Projects (linked projects), Documents (file upload/download up to 10MB)
11. `/bills` — Billing: Normal & GST invoices, item lists, auto-bill numbers, PDF download, WhatsApp/Email/SMS/Telegram sharing
12. `/finance` — Financial transactions: income/expense tracking with approval flow
13. `/inventory` — Stock management with SKUs, restock workflow, low-stock alerts

### Marketing
14. `/marketing` — Campaign management
15. `/digital-marketing` — Social media scheduling (FB/IG/LinkedIn/Twitter/YouTube), media upload, bulk messaging (Email/SMS/WhatsApp campaigns), n8n webhook automation integration

### Platform
16. `/billing` — SaaS billing plans, subscriptions, invoices (existing)
17. `/analytics` — Revenue charts, attendance stats, project metrics
18. `/reports` — Filterable reports: Attendance (by dept/date, ±7 stat cards), Project Progress (by status, progress bars), Financial Summary (by type/category, net balance), Department Performance (attendance rates, project completion), Audit Report (by action, top users chart); PDF & Excel export on every tab
19. `/audit` — Tabbed: (1) Bank Reconciliation: upload bank statements (CSV/PDF), manage cashbook entries, auto-match engine (±3 days, ±₹0.01), generate comparison reports with CSV export; (2) Activity Log: full audit trail of user actions

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express 5 API (JWT auth, all 18 route modules)
│   └── business-automation/ # React + Vite frontend (18 pages)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks (original endpoints)
│   ├── api-zod/            # Generated Zod schemas
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/     # 14 schema files, 16+ tables
├── scripts/
│   └── src/seed.ts         # Database seed script
```

## Database Schema (16+ tables)

### Core
- `tenants` — Multi-tenant organizations
- `users` — Users with roles, employee codes, employment details (auto-generated EMP-XXX-XXXX)
- `departments` — Org departments with heads

### HR
- `attendance` — Daily attendance records with check-in/out times

### Projects
- `projects` + `project_tasks` — Project and task tracking with status/priority

### Billing (SaaS)
- `billing_plans` + `subscriptions` + `invoices` — Platform billing system

### CRM & Finance
- `clients` — Client relationship management (+ clientCode, whatsapp, state, gstNumber columns)
- `client_interactions` — Interaction log (call/email/meeting/whatsapp/followup) with follow-up dates
- `client_documents` — Client document uploads (base64 or S3)
- `bills` + `bill_items` + `bill_counters` — Invoice/quote system with auto-numbering trigger
- `financial_transactions` — Income/expense/transfer tracking with approval

### Operations
- `inventory_items` + `inventory_transactions` — Stock management with restock history
- `documents` + `document_views` — Document library with approval workflow

### Marketing
- `campaigns` — Marketing campaigns
- `digital_marketing_posts` — Social media posts across 6 platforms

### Audit & Reconciliation
- `bank_statements` — Uploaded bank statement files (CSV/PDF, parsed metadata)
- `bank_statement_entries` — Individual transactions extracted from bank statements
- `cashbook_entries` — Manual or bulk-imported cashbook entries
- `reconciliation_reports` — Generated reconciliation comparison reports with JSON detail

### System
- `calendar_events` — Events, meetings, deadlines with recurrence
- `holidays` — Company and public holidays
- `audit_entries` — Complete user action audit trail

## Database Triggers

- **Auto bill numbers**: PostgreSQL trigger `auto_bill_number` generates `INV-2026-000001`, `QUO-2026-000003` etc. using `bill_counters` table
- **Auto employee codes**: PostgreSQL trigger `auto_employee_code` generates `EMP-002-0001` format on user insert

## Attendance System

- `/attendance` — Face Recognition Check-In/Out with GPS location
- **Schema columns added**: `latitude`, `longitude`, `address`, `face_verified` (bool), `face_confidence`, `check_in_photo`, `check_out_photo`
- **Check-in flow**: Opens dialog → webcam feed (getUserMedia) → face detection overlay (FaceDetector API where available) → capture → backend `/attendance/face-verify` returns AI confidence → GPS via Geolocation API → Nominatim reverse geocoding → Confirm submits to `/attendance`
- **Face verification**: `POST /attendance/face-verify` (simulated; production-ready to swap for Azure Face API or AWS Rekognition)
- **Department report**: `GET /attendance/department-report` groups present/absent/late by department with attendance rate %
- **Role differences**: employees see only My History tab; managers see My History + All Records + Department Report + 4 summary stat cards
- **Demo accounts**: All 4 roles now exist — employee@demo.com (Mike Davis) added directly

## Frontend API Pattern

- Original endpoints (auth, users, tenants, departments, attendance, projects, billing, marketing, analytics): use generated React Query hooks from `@workspace/api-client-react`
- Extended endpoints (clients, bills, calendar, finance, inventory, documents, digital-marketing, audit): use `apiFetch()` utility in `src/lib/api.ts` with `@tanstack/react-query`
- **Auth injection**: `lib/api-client-react/src/custom-fetch.ts` automatically reads `localStorage.getItem("token")` and adds `Authorization: Bearer <token>` to all generated hook requests
- API responses: `/audit` and `/clients` routes return plain arrays (not wrapped in `{ entries: [] }` or `{ clients: [] }`); dashboard uses `Array.isArray()` guards before calling `.slice()`

## Navigation Structure

Sidebar is organized into collapsible groups:
- **Overview**: Dashboard, Analytics
- **HR & People**: Organizations, Users, Departments, Attendance
- **Work**: Projects, Calendar, Documents
- **Business**: Clients, Bills & Invoices, Finance, Inventory
- **Marketing**: Campaigns, Digital Marketing
- **Platform**: Billing, Audit Log

## Running

- Frontend: `pnpm --filter @workspace/business-automation run dev`
- API: `pnpm --filter @workspace/api-server run dev`
- Seed: `pnpm --filter @workspace/scripts run seed`
- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`

## Brand Colors

- Primary (sidebar): `#292e4e` (dark navy)
- Secondary: `#ffffff` (white)
- Accent: `#4f46e5` (indigo)
- Background: `#f5f7fb` (light blue-gray)

## Deployment (AWS)

### Production Architecture
- **Container**: Single Docker image (Node.js 22-slim) — API + static frontend
- **Hosting**: AWS ECS Fargate (`bizauto-cluster` / `bizauto-api-service`)
- **Container Registry**: Amazon ECR (`bizauto-api` repo)
- **Database**: AWS RDS PostgreSQL 16 (private subnet, sslmode=require)
- **File Storage**: AWS S3 (`bizauto-uploads-prod`) via `src/lib/storage.ts`
- **Secrets**: AWS Secrets Manager (`bizauto/prod/*`)
- **Reverse Proxy**: Nginx (`nginx/nginx.conf`) — serves SPA + proxies `/api/*`
- **Health Check**: `GET /api/health` → `{ status: "ok", uptime, env }`

### Key Files
| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: frontend + API → Node 22-slim image |
| `.dockerignore` | Exclude node_modules, dist, .env from Docker context |
| `docker-compose.yml` | Local dev with PostgreSQL |
| `docker-compose.prod.yml` | Single-server production simulation |
| `nginx/nginx.conf` | Nginx SPA + API proxy + rate limiting |
| `.env.example` | All required environment variables |
| `.github/workflows/ci.yml` | CI: typecheck + build + Docker validate on every PR |
| `.github/workflows/deploy.yml` | CD: push to ECR → update ECS on push to `main` |
| `aws/task-definition.json` | ECS Fargate task definition template |
| `scripts/setup-aws.sh` | One-time AWS infra provisioning (ECR, S3, ECS, RDS, IAM) |
| `scripts/deploy.sh` | Manual deploy helper |
| `scripts/db-migrate.sh` | Run Drizzle schema push against production DB |
| `artifacts/api-server/src/lib/storage.ts` | S3/local file upload abstraction |

### CI/CD Flow
```
Push to main
  → GitHub Actions CI (typecheck + build + docker validate)
  → On pass: build & push Docker image to ECR
  → Update ECS task definition with new image SHA
  → ECS rolling deploy (wait for stability)
  → Run DB migrations via ECS one-off task
```

### Required GitHub Secrets (for CD)
`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`ECR_REGISTRY`, `ECR_REPOSITORY`, `ECS_CLUSTER`, `ECS_SERVICE`,
`ECS_TASK_DEFINITION`, `CONTAINER_NAME`, `DATABASE_URL`,
`VPC_SUBNETS`, `VPC_SECURITY_GROUPS`

### S3 Storage
- Set `USE_S3=true` in environment to use S3 instead of base64-in-DB
- Set `S3_BUCKET_NAME`, `S3_BUCKET_REGION`, `S3_CDN_URL`
- Presigned uploads supported via `getPresignedUploadUrl()` in storage.ts
