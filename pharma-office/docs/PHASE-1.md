# Phase 1 — Foundation: completion report

## What is included

**Data & platform**
- PostgreSQL schema for the full domain model (30 tables): territories, users, drugstores, credit limits (with history), pharmacies, competitors, products, SKUs, batches, commercial offers, invoices and lines, payments and allocations, collection activity log, returns, sales targets, market signals, market prices, alerts, tasks, notes, audit logs, data sources, imports, and metric/score snapshot tables for later phases.
- Lineage columns (`source_type`, `source_entity`, `source_date`, `confidence`, `evidence_reference`) on every intelligence table.
- CHECK constraints for financial integrity; indexes for the main access paths, including a partial index on open receivables.

**Security**
- Email/password login (bcrypt), signed HTTP-only session cookie, generic error on failure with equalised timing, audit log of logins / failures / logouts.
- Seven roles with a permission matrix. Drugstore scoping: Director, Sales Manager and Finance see all; Area Manager sees their territory; Sales Rep sees assigned drugstores; Medical Rep has no financial access unless `financial_access` is granted; Admin has configuration but no financial visibility.
- Every query and server action applies the user's scope; server actions re-check permission and validate input with Zod.

**Modules**
- **Dashboard:** Sales this month (vs same days last month, vs target with month progress, vs last year when data exists); Collections this month (collected, falling due, achievement); Total exposure split not-due / overdue; Overdue (amount, % of receivables, drugstores overdue); Market signals count (Reported); 12-month sales trend; receivables composition; drugstores by exposure; **Attention required** from confirmed data (overdue, due within 7 days, credit utilisation ≥ 85 %, disputed) with severity, confidence, source, evidence, recommended action and responsible person. Severity thresholds are explicit constants in `src/lib/domain/attention.ts`.
- **Drugstores:** list with YTD sales, outstanding, overdue, limit and utilisation; detail with identification, commercial relationship, financial relationship, returns (12 months), recent invoices and payments, and reported market signals.
- **Sales & invoices:** list filtered by search, territory, drugstore, product, rep, date range, payment status, batch expiry and amount; paginated with totals. Invoice detail shows list price, invoice price, discount, bonus and **effective net price** per line, plus commercial investment and allocated payments. Manual invoice entry with live effective-price preview; totals are recalculated on the server.
- **Collections:** payments list with filters and KPIs; record payment with a live **FIFO allocation preview** (oldest due first, disputed invoices skipped, remainder kept on account). Allocation runs in a transaction with row locks.
- **Products:** list with scoped sales, buyers, last sale and nearest expiry; detail with SKUs, monthly sales, batches (received, delivered, calculated office stock, months to expiry) and purchasing drugstores with days since last purchase.
- **Market signals:** read-only list of recorded signals with source, confidence and status.
- **Settings:** read-only users and roles.
- **Risks & Alerts, Reports:** honest “not yet available” pages describing the planned scope.

**Bilingual / regional**
- English and Arabic with proper RTL, locale in the URL, language switch on every page.
- IQD shown compactly (“IQD 125M” / “125 مليون د.ع”) in management views and exactly in tables; dates in the Asia/Baghdad calendar.

**Demo data** (fictional; regenerated relative to the seed date)
- 10 drugstores, 40 products, 162 batches, ~13 months of invoices (~IQD 0.5B/month), payments, returns, credit limits, monthly targets, 2 offers, 22 market signals and price observations.
- Scenarios: healthy growing account (Al-Shifa); high sales with deteriorating payment ≈80 → ≈104 days and 94 % utilisation (Al-Noor); high returns (Dar Al-Dawaa); strong payer (Ibn Sina); weak reorder (Al-Rafidain); reported-slow-but-reordering inconsistency (Babil); sudden spike (Al-Hayat); collection deterioration (Kurdistan Medical); large short-dated purchase with no reorder plus a disputed invoice (Tigris); fast-moving Glucotrin; fading Osteval reorders; short-dated Glimetra batch; Rosuvan low-price reports.

## Verification performed

- `npm run typecheck` — clean. `npm run lint` — clean. `npm run build` — succeeds with no warnings.
- `npm test` — 31 tests: domain logic (pricing incl. the buy-10-get-2 example, payment status precedence, FIFO allocation, formatting, dates, severity rules), permissions and scoping, demo-data invariants, and database integration tests (SQL status filters match the TypeScript rules for every invoice; `paid_amount` equals allocations; rep scoping).
- Browser walkthrough (Playwright, production build) of every page in English and Arabic as the Sales Manager; invoice creation and payment recording through the UI, confirmed in the database (correct totals, due date, FIFO allocation, audit entries); wrong password and future payment dates rejected server-side; scoping checked for area manager, sales rep, medical rep and admin; mobile layout (390 px, Arabic) without horizontal overflow.

## Known limitations

- **Returns do not yet reduce receivables.** Return value is shown separately; credit-note posting against invoices is planned for Phase 2.
- **Payment allocation is FIFO only.** Choosing specific invoices to allocate to is not yet supported.
- **Office stock is calculated** (received − delivered). Physical stock counts are not integrated.
- **No CSV/Excel import or report export yet.** Data enters through the forms and the demo seed.
- **Attention items are computed live**, not persisted; status and notes workflow arrives with the Phase 5 risk engine.
- **No login rate limiting** yet; add it (or a WAF rule) before exposure to the internet.
- **Arabic copy** was written by the developer and should be reviewed by a native-speaking commercial lead.
- **Offline / poor-connection support** is not implemented yet.
- Invoices cannot yet be edited, voided or marked disputed from the UI.
