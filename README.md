# NepaEng Platform

Self-hosted engineering consultancy CRM & project delivery platform inspired by Monday.com.

Built with **Next.js 14 (App Router)**, **Prisma + PostgreSQL**, **Tailwind CSS + shadcn/ui**, **frappe-gantt**, and **node-cron** for MYOB payment polling.

---

## Quick Start

### Prerequisites

- Node.js 18.18+ (20 or 22 recommended)
- PostgreSQL 13+ running and accessible
- npm (or pnpm / yarn)

### 1. Install

```bash
cd nepaeng-platform
npm install        # postinstall runs prisma generate
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/nepaeng_platform?schema=public"
AUTH_SECRET="<generate: openssl rand -base64 48>"
```

MYOB variables can stay empty until you're ready to test the integration.

### 3. Database

```bash
npx prisma migrate dev --name init
npm run db:seed
```

The seed script creates demo users, proposals, projects, Gantt tasks, and timesheet entries. Credentials are printed to the console.

### 4. Run

```bash
npm run dev
# http://localhost:3000
```

---

## Seeded Login Credentials

| Role           | Email                        | Password       |
| -------------- | ---------------------------- | -------------- |
| ADMINISTRATOR  | director@nepaeng.com.au      | ChangeMe123!   |
| ENGINEER       | engineer@nepaeng.com.au      | Engineer123!   |
| ENGINEER       | engineer2@nepaeng.com.au     | Engineer123!   |
| BOOKKEEPER     | accounts@nepaeng.com.au      | Accounts123!   |

---

## RBAC Matrix

| Resource                     | ADMINISTRATOR | ENGINEER        | BOOKKEEPER  |
| ---------------------------- | ------------- | --------------- | ----------- |
| Proposals & CRM              | Full R/W      | 403 Blocked     | 403 Blocked |
| Project Financials           | Full R/W      | Hidden from DOM | Full R/W    |
| Project Scope / Gantt        | Full R/W      | Full R/W        | Read-only   |
| Timesheets                   | View all      | Create own only | View all    |
| User Management              | Full R/W      | 403 Blocked     | 403 Blocked |

---

## MYOB Integration

1. Register an app at https://developer.myob.com and fill the `MYOB_*` vars in `.env`.
2. Navigate to **Settings > MYOB** and click **Connect MYOB** (OAuth2 flow).
3. On any project's **Financials** tab, enter the MYOB Customer UID and click **Create MYOB Invoice**.
4. Payment status polling runs via node-cron when `MYOB_POLL_ENABLED=true`.

---

## Scripts

| Command              | Description                              |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Next.js development server               |
| `npm run build`      | Production build (runs prisma generate)  |
| `npm run start`      | Start production server                  |
| `npm run typecheck`  | TypeScript type-check (no emit)          |
| `npm run lint`       | ESLint                                   |
| `npm run db:seed`    | Re-seed demo data                        |
| `npx prisma studio`  | Visual database browser                  |

---

## Project Structure

```
nepaeng-platform/
├── prisma/
│   ├── schema.prisma       # Full schema (User, Proposal, Project, Comment, Timesheet, MyobSettings)
│   └── seed.ts             # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (dashboard)/    # Authenticated layout group (sidebar + topbar)
│   │   │   ├── dashboard/
│   │   │   ├── admin/users/
│   │   │   ├── proposals/
│   │   │   ├── projects/
│   │   │   ├── timesheets/
│   │   │   └── settings/myob/
│   │   ├── api/            # Route handlers
│   │   ├── login/
│   │   ├── change-password/
│   │   └── 403/
│   ├── components/
│   │   ├── ui/             # shadcn-style primitives
│   │   ├── layout/         # Sidebar, Topbar
│   │   ├── shared/         # DisciplineBadges, PageHeader, DisciplinePicker
│   │   └── gantt/          # frappe-gantt wrapper
│   ├── lib/                # Auth, RBAC, Prisma, MYOB client, validation, utils
│   ├── middleware.ts       # Edge middleware (auth + route RBAC)
│   └── instrumentation.ts  # node-cron MYOB poller boot
├── .env.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```
