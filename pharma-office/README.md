# Scientific Office Commercial Intelligence

Decision-support web application for the **Sales / Commercial Manager of an Iraqi pharmaceutical scientific office**. It helps answer one question:

> Are we selling healthy business, or merely pushing stock into the channel?

It covers the Office's relationship with licensed drugstores — what was sold, collected, agreed and reported. It is **not** a drugstore ERP and deliberately has no drugstore-internal stock, pharmacy invoices or drugstore accounting.

Every important figure is labelled **CONFIRMED** (Office records), **REPORTED** (field / drugstore / pharmacy information) or **ESTIMATED** (system-generated from patterns). Estimates are never presented as fact.

## Status

The build is phased. **Phase 1 — Foundation is complete**; see [`docs/PHASE-1.md`](docs/PHASE-1.md) for what is included, how it was verified and known limitations, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the assessment and roadmap. Modules not built yet are labelled in the UI (“Partial”, “Phase N”, “Planned”); nothing is simulated.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Zod · Vitest. Bilingual English / Arabic (RTL) from the start.

## Getting started

Requirements: Node.js ≥ 22 and PostgreSQL ≥ 14.

```bash
cd pharma-office
npm install
cp .env.example .env.local      # then edit DATABASE_URL and SESSION_SECRET
npm run db:setup                # apply migrations + load the fictional demo data
npm run dev                     # http://localhost:3000
```

With `DEMO_MODE=true` the login page lists demo accounts (one per role). All use the password `Demo@2026`. **Never enable demo mode or load demo data in production.**

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development / production build / production server |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest). Set `RUN_DB_TESTS=true` to also run database integration tests against a seeded DB |
| `npm run db:generate` | Generate a SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations in `drizzle/` |
| `npm run db:seed` | **Wipe** the database and load demo data (refuses when `NODE_ENV=production`) |

## Project layout

```
src/
  app/[lang]/            Routes; [lang] = en | ar. (app)/ holds authenticated pages
  components/            ui/ primitives, data/ display components, shell/ navigation
  db/                    schema.ts, client, migrate script, seed/ (catalog + deterministic generator)
  lib/
    domain/              Pure business logic: pricing, payment status, allocation, attention rules, dates, money
    auth/                Sessions, current user, role permissions & drugstore scoping
    i18n/                Locale config and en / ar dictionaries
  server/
    queries/             Read-side data access (every query is scoped to the user)
    actions/             Server actions (login, invoices, payments) — validated, transactional, audited
  proxy.ts               Locale prefixing and optimistic auth redirect
drizzle/                 SQL migrations
tests/integration/       Database integration tests
```
