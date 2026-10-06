# Architecture assessment and plan

Written before implementation began (Phase 1), as required by the build brief.

## Current state (repository as found)

| Area | Finding |
| --- | --- |
| Stack | A single 2,372-line `index.html` loading React 18 from a CDN and compiling JSX in the browser with Babel standalone. No `package.json`, no build step. |
| Pages | One app: a “Behavioral Reinforcement Platform” for sales-training workshops. **Unrelated** to the pharmaceutical office product. |
| Database | None. All data hard-coded in JavaScript. |
| Authentication | None (role switching in UI state only). |
| Components | Inline in the same file; not reusable for this domain. |
| Deployment | None configured. |
| Environment variables | None. |
| Reusable modules | None applicable. |
| Problems | In-browser compilation is unsuitable for production; no persistence, no security, one huge file. |

**Decision:** leave `index.html` untouched (it still works as before) and build the new application in `pharma-office/`.

## Target architecture

- **Next.js 16 App Router** with Cache Components. Authenticated content is rendered per request behind Suspense boundaries; financial data is never cached server-side, so figures are always current.
- **PostgreSQL + Drizzle ORM.** Schema in TypeScript (`src/db/schema.ts`), versioned SQL migrations in `drizzle/`. Money in whole IQD as `BIGINT`; CHECK constraints guard financial invariants (e.g. `paid ≤ net`).
- **Data lineage** on every intelligence table: `source_type` (confirmed / reported / estimated), `source_entity`, `source_date`, `confidence`, `evidence_reference`.
- **Auth:** email + bcrypt password, signed HTTP-only JWT session cookie (`jose`). A Data Access Layer re-reads the user on every request so deactivation or role changes apply immediately. The proxy does only an optimistic redirect.
- **Authorisation:** a pure role → permission matrix plus drugstore scoping (all / territory / assigned rep), applied inside every query and every server action.
- **Pure domain layer** (`src/lib/domain`): pricing / effective price, payment status, FIFO allocation, severity rules, dates in the Asia/Baghdad calendar. Unit-tested and shared by server and client.
- **i18n:** locale in the URL (`/en`, `/ar`), `<html lang dir>` set in the root layout, typed dictionaries (Arabic must cover every English key, or the build fails).
- **No AI in the core.** The Phase 7 AI layer will only interpret structured, evidence-linked data.

### Supabase

The brief lists Supabase “if appropriate”. No Supabase project exists for this repository, and creating one is an account-level decision for the owner. The schema is plain PostgreSQL and runs unchanged on Supabase Postgres. Authentication is self-contained today; moving to Supabase Auth and row-level security later is possible but would replace `src/lib/auth/session.ts` and add RLS policies mirroring `drugstoreScopeFor()`.

## Gaps (brief vs. Phase 1)

| Brief area | Status after Phase 1 |
| --- | --- |
| Architecture, schema, auth, roles | Done |
| Drugstores, products, invoices, payments | Done (core facts, list/detail, manual invoice and payment entry) |
| Basic dashboard | Done (confirmed KPIs + confirmed-data attention items) |
| Demo data | Done (deterministic, fictional, scenario-driven) |
| Aging, DSO, payment behaviour, credit recommendations, collection priority, Drugstore 360 intelligence | Phase 2 |
| CSV / Excel import, report exports | Proposed for Phase 2 (import) and alongside reporting |
| Reorder patterns, movement classification, expiry & return risk | Phase 3 |
| Field submission, signal validation, price monitoring | Phase 4 (signals are already stored with lineage and listed read-only) |
| Persistent alerts workflow, inconsistency engine | Phase 5 (tables exist) |
| Healthy Sell-In, Business Quality | Phase 6 |
| AI management brief and queries | Phase 7 |
| Offline support | Not started; Phase 4 (field entry) is the natural place for an offline queue |

## Implementation plan

1. **Phase 1 — Foundation** (this delivery): project, schema + migrations, auth, roles and scoping, drugstores, products, invoices, payments, basic dashboard, bilingual UI, demo data, tests, CI.
2. **Phase 2 — Commercial & collection intelligence:** aging buckets (not-due vs overdue), payment-behaviour metrics with trends, DSO, utilisation history, collection priority engine, advisory recommended exposure with reasons, Drugstore 360 relationship components; CSV/Excel import with row-level validation; credit notes for returns against receivables.
3. **Phase 3 — Product & expiry intelligence:** reorder cycles per product × drugstore, movement classification with UNKNOWN when evidence is thin, estimated expiry exposure and return risk with confidence and evidence.
4. **Phase 4 — Market intelligence:** sub-30-second mobile signal entry, multi-source confidence, price observations vs effective selling price.
5. **Phase 5 — Risk engine:** persisted, deduplicated alerts with assignee / due date / status workflow; information-consistency checks in neutral language.
6. **Phase 6 — Healthy Sell-In:** transparent factor-based scoring with full breakdown; Business Quality (Healthy / Watch / Weak).
7. **Phase 7 — AI management layer:** briefings and questions answered only from structured, cited evidence.

After every phase: typecheck, lint, tests, build, manual verification of major flows, and a written phase report.
