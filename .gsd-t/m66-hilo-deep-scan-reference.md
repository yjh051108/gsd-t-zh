# Tech Debt Register — Hilo ATOS

> Source: GSD-T deep scan (6 specialized agents + 1 synthesis), 2026-05-29.
> Ranked critical → low. Promote items to milestones with `/gsd-t-promote-debt`.

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 14 |
| HIGH | 61 |
| MEDIUM | 37 |
| LOW | 5 |

> Totals above are grand totals (original TD-01..TD-16 + deep-scan TD-17..TD-117).
> Original scan: TD-01..TD-16. Deep Scan (2026-05-29): TD-17..TD-117 — see the
> "Deep Scan — Additional Findings" section below. Items already represented by
> TD-01..TD-16 (E2E auth-bypass default secret, tenant-scoping, OpenAPI, coverage
> thresholds, quarantined E2E, manual input validation, etc.) were cross-referenced
> rather than duplicated where they overlap with new items.
> Grand totals — Critical 14 (2 orig + 12 deep) · High 61 (5 + 56) · Medium 37 (6 + 31) · Low 5 (3 + 2).

---

## CRITICAL

### TD-01 — Hardcoded Neon DB credentials in `package.json`
- **Area:** Secrets / Security
- **Detail:** 8 npm scripts embed full Neon connection strings with live passwords inline (two distinct passwords — UAT + DEV — repeated across pairs). Committed to source.
- **Files:** `package.json:56-57` (`seed:e2e-users:uat/dev`), `:61-62` (`backfill:dispatches:uat/dev`), `:66-67` (`seed:super-admins:uat/dev`), `:69-70` (`seed:frc:uat/dev`).
- **Also flagged in scripts:** `scripts/sync-schools.ts`, `scripts/backfill-schedule-fks.ts`, `scripts/migrate-legacy.ts`, `.pipeline-db.js` (verify each).
- **Recommendation:** **Rotate both Neon passwords immediately.** Replace inline URLs with `$DATABASE_URL_UAT` / `$DATABASE_URL_DEV` env refs (the migrate scripts at `package.json:33-34` already do this — follow that pattern). Audit git history for prior exposure.

### TD-02 — `.env.uat-preview` with secrets in working tree
- **Area:** Secrets / Security
- **Detail:** 4.5KB file, ~21 lines containing `SECRET`/`KEY`/`PASSWORD`/`postgresql`. `git ls-files` returned empty (appears untracked) but it is an accidental-commit hazard sitting at repo root.
- **Files:** `/.env.uat-preview`
- **Recommendation:** Confirm `.gitignore` covers it, purge the file, rotate any live values, verify it was never committed historically.

---

## HIGH

### TD-03 — E2E auth-bypass hardcoded default secret
- **Area:** Security
- **Detail:** Bypass is correctly gated behind `!isProductionRuntime()`, but falls back to `DEFAULT_E2E_AUTH_BYPASS_SECRET` when `E2E_AUTH_BYPASS_SECRET` is unset — risky if the prod guard is ever misconfigured.
- **Files:** `src/lib/e2e-auth-bypass.ts:36`
- **Recommendation:** Require the env var, no default; fail closed.

### TD-04 — No structural tenant-scoping enforcement
- **Area:** Multi-tenant isolation
- **Detail:** Isolation is per-query manual scoping on `flightSchoolId`/`locationId`. No centralized scoped-DB helper (`getScopedDb`/`withFlightSchool` → 0 hits). A forgotten predicate silently leaks cross-tenant data. ~26 services don't reference `flightSchoolId` (some legitimately platform-level — needs audit). The Postgres-session substrate exists (`src/lib/db-tenant-context.ts`) but isn't the enforced path.
- **Files:** `src/server/services/*`, `src/server/middleware/auth.ts`, `src/lib/db-tenant-context.ts`
- **Recommendation:** Add a scoped-DB helper or enable Postgres RLS as defense-in-depth; per-route audit of services lacking the scope predicate. (Invariant I6 catches the obvious cases at CI but not all.)

### TD-05 — No OpenAPI/Swagger spec for ~189 endpoints
- **Area:** API documentation
- **Detail:** Two API frameworks (~139 Hono modules + 50 Next route handlers). Only formal doc is `docs/hilo-atos-client-ingestion-api.md`. No OpenAPI tooling in deps; no `/api-docs` route. GSD-T API Documentation Guard requires a spec.
- **Files:** `src/server/routes/`, `src/app/api/`
- **Recommendation:** Generate OpenAPI (Hono supports `@hono/zod-openapi`); serve `/api-docs`; publish URL in CLAUDE.md / README / docs/infrastructure.md.

### TD-06 — Coverage thresholds at ~actual (~15% lines)
- **Area:** Quality / testing
- **Detail:** Global Jest thresholds `lines:15, functions:8` — comment admits set "just below actual coverage (17.7% lines, 10.2% branches) to prevent regression." Effectively ~16% line coverage on a production billing platform. Critical-path per-file thresholds do exist (auth middleware 90%, rate-limit 50%, orchestrator 75-85%).
- **Files:** `jest.config.ts:99-104`
- **Recommendation:** Ratchet upward quarterly; prioritize accounting/billing/auth/tenant-scoping coverage.

### TD-07 — mvp-v2 lint + a11y disabled wholesale
- **Area:** Lint integrity / accessibility
- **Detail:** `biome.json` disables a wide rule set for `src/components/features/mvp-v2/**` — `noExplicitAny`, `noArrayIndexKey`, `useExhaustiveDependencies`, `noConstantCondition`, `noDangerouslySetInnerHtml`, and 9 a11y rules. mvp-v2 is **474 of 510 components (93% of the UI)** — enforcement is effectively off for nearly the whole front-end.
- **Files:** `biome.json:89-124`
- **Recommendation:** Re-enable incrementally (a11y + `noDangerouslySetInnerHtml` first); treat as a remediation milestone.

---

## MEDIUM

### TD-08 — Large binaries committed at root
- **Area:** Repo bloat
- **Detail:** `migration_output.sql` (33MB), `hilo-figma-atos-main.zip` (69MB), `hilo-tests-audit.zip` (97KB) — clones/CI checkouts pull all of this every time.
- **Files:** `/migration_output.sql`, `/hilo-figma-atos-main.zip`, `/hilo-tests-audit.zip`
- **Recommendation:** Delete or move to artifact storage / git-lfs; gitignore. (Note: `hilo-figma-atos-main.zip` is the original onboarding archive — safe to remove once confirmed extracted.)

### TD-09 — Root-level status/scratch markdown clutter
- **Area:** Repo hygiene
- **Detail:** 15+ files: `AGENT_COMPLETE.md`, `IMPLEMENTATION_COMPLETE.md`, `MORNING_REVIEW_SUMMARY.md`, `diagnosis.md`, `REMAINING_ISSUES`, `CHANGED_FILES`, `VALIDATION_REPORT.md`, `RESOLVE_DEVIATIONS_PROMPT.md`, `REQUIREMENTS_VS_ACTUAL.md`, `validation-plan.md`, `billing-change-request.md`, `FRC-V2-WAVE-1-PRD-FINAL.md`, `KV_AUDIT_MANIFEST.md`, `protected-surface.md`.
- **Recommendation:** Move to `docs/archive/` or delete. (Keep `protected-surface.md` if PDD tooling reads it from root — verify first.)

### TD-10 — Stray / duplicate directories
- **Area:** Repo hygiene
- **Detail:** `hilo-updated/`, `wave-1/`, `wave-2-3-delivery/`, `migration_batches/`, `outputs/`, `rehearsals/`, `.pipeline-tmp/`, `qa-evidence/`, `.figma-make-exports/`. Unclear which is canonical; `hilo-updated/` contains a duplicate e2e snapshot.
- **Recommendation:** Remove or archive; clarify canonical source.

### TD-11 — Quarantined / skipped E2E specs (~27)
- **Area:** Testing
- **Detail:** ~27 `e2e/*.spec.ts` carry `.skip`/`.only`/`xit`. `docs/ci-quarantine-policy.md` exists, so quarantine is active — but failing functional E2E on billing/scheduling is high-risk while suppressed.
- **Files:** `e2e/`, `docs/ci-quarantine-policy.md`
- **Recommendation:** Burn down the quarantine list; convert any layout-only tests to functional assertions.

### TD-12 — Empty `src/repositories/` (abandoned pattern)
- **Area:** Data access consistency
- **Detail:** Directory exists with 0 `.ts` files; data access is service → Drizzle directly. (Earlier scan saw a monolithic `mvp-v2.repository.impl.ts` ~17K lines — confirm whether it was removed or relocated.)
- **Files:** `src/repositories/`
- **Recommendation:** Remove the dir or adopt the pattern; resolve the discrepancy.

### TD-13 — Partial rate-limit coverage
- **Area:** Security / resilience
- **Detail:** `@upstash/ratelimit` applied via `src/server/middleware/rate-limit.ts` but not universally across the 139 route modules. Limiter also fails open on Redis outage (acceptable in dev, risky in prod for auth/brute-force).
- **Files:** `src/server/middleware/rate-limit.ts`
- **Recommendation:** Apply to all auth/write/webhook routes; consider hard-fail (503) in prod when Redis is down.

---

## LOW

### TD-14 — Loose ops scripts at repo root
- **Area:** Repo hygiene
- **Detail:** `migrate_to_kv.py`, `push_to_supabase.py`, `run-neon-ops.mjs`, `run-task-ops.mjs` sit at root.
- **Recommendation:** Move under `scripts/`.

### TD-15 — Split schema source of truth
- **Area:** Architecture clarity
- **Detail:** Canonical schema is `src/lib/schema/`, but `src/db/schema/quickbooks.ts` also exists — two schema homes.
- **Files:** `src/lib/schema/index.ts`, `src/db/schema/quickbooks.ts`
- **Recommendation:** Consolidate under one path.

### TD-16 — Manual input validation (no Zod) on some routes
- **Area:** Input validation
- **Detail:** A few routes accept raw `c.req.json()` without a schema (e.g. `routes-workflows.ts`, `routes-places.ts`), mapping fields manually.
- **Files:** `src/server/routes/routes-workflows.ts`, `src/server/routes/routes-places.ts`
- **Recommendation:** Add Zod schemas to all body-accepting handlers.

---

## Deep Scan — Additional Findings (2026-05-29)

> Source: GSD-T deep scan 2026-05-29, adversarially verified. Items already covered
> by TD-01..TD-16 were deduplicated out. Broken-functionality findings (dead
> buttons/tabs, forms-not-saving) live in `.gsd-t/broken-functionality.md`, not here.

## CRITICAL (deep scan)

### TD-17 — Privilege escalation via /update-user-metadata
- **Area:** Authorization / Privilege Escalation
- **Detail:** `metadata` is spread directly into the authUser SET clause behind only `requireAdmin()`. A school-level admin can POST `{userId, metadata:{role:'super_admin'}}` to elevate any user (role, emailVerified, banned, etc. all writable).
- **Files:** `src/server/routes/routes-auth.ts:848`
- **Recommendation:** Replace the spread with an explicit field allowlist; gate role changes behind `requireSuperAdmin()` and the dedicated grant/revoke endpoints; add an allowlist unit test.

### TD-18 — LMS courses not scoped to flightSchoolId (cross-tenant leak)
- **Area:** LMS / Multi-tenancy
- **Detail:** `findAllCourses`/`findCourseById`/`updateCourse`/`deleteCourse` never filter on flightSchoolId; `saveCourseDetail` inserts NULL flightSchoolId. `GET /lms/courses` and `/lms/stats` leak/modify every tenant's study guides.
- **Files:** `src/repositories/mvp-v2.repository.impl.ts:6218`; `src/server/routes/routes-lms.ts`
- **Recommendation:** Thread orgId into all read/write course methods with a `.where(eq(lmsCourses.flightSchoolId, orgId))` clause; make the column NOT NULL and require it on insert.

### TD-19 — billing-invoice-cron Stripe items created outside any transaction
- **Area:** Invoice Generation / Transaction Safety
- **Detail:** createInvoiceItem (x3), createInvoice, the invoices insert, and billingCredits updates are sequential awaits with no transaction or idempotency keys. A failure between steps leaves Stripe and the DB inconsistent (orphan invoice items, or local invoice without Stripe invoice).
- **Files:** `src/app/api/billing-invoice-cron/route.ts:291-353`
- **Recommendation:** Wrap DB writes in withTransaction(); add idempotency keys to all Stripe calls so retries don't duplicate.

### TD-20 — Stage Checks: flightSchoolId from body/query, no session validation (IDOR)
- **Area:** Multi-tenant isolation
- **Detail:** GET/POST schedules read flightSchoolId from query/body; GET results/:id has no flightSchoolId scope at all. `resolveOrgIdFromSession` is never called. Any authenticated user can read/insert another tenant's stage-check records.
- **Files:** `src/server/routes/routes-stage-checks.ts:105`
- **Recommendation:** Derive orgId from `resolveOrgIdFromSession`; 403 on null; add flightSchoolId scope to every WHERE clause including GET /:id routes.

### TD-21 — Messages Contacts: any user can enumerate all users across all schools
- **Area:** Multi-tenant isolation
- **Detail:** `/messages/contacts/global` (documented super-admin-only) uses `requireAuth()` and returns all users for all schools; `/messages/contacts/school/:flightSchoolId` has no session-vs-param check.
- **Files:** `src/server/routes/routes-messages.ts:196`
- **Recommendation:** Gate global on `requireSuperAdmin()`; on the school route resolve orgId and 403 unless it matches the param (super_admin exempt).

### TD-22 — MiCamp payment endpoints: requireAuth only, flightSchoolId unverified
- **Area:** Multi-tenant isolation
- **Detail:** POST /micamp/cards and /micamp/payments take flightSchoolId from the body with no ownership check, so a user can tokenize/charge against any school's MiCamp config. GET /micamp/enabled leaks processor config to any user.
- **Files:** `src/server/routes/routes-micamp.ts:279`
- **Recommendation:** After auth, `resolveOrgIdFromSession` and 403 on flightSchoolId mismatch; elevate /micamp/enabled to `requireAdmin()`.

### TD-23 — Standby promote uses requireAuth() not requireAdmin()
- **Area:** Authorization / standby
- **Detail:** POST /schedule/standby/:id/promote is documented "Admin: manually promote" but uses bare `requireAuth()`. Any authenticated student who knows a standby UUID can self-promote to 'notified', trigger an SMS, and bypass the queue.
- **Files:** `src/server/routes/routes-standby.ts:212`
- **Recommendation:** Change to `requireAdmin()`.

### TD-24 — billing-invoice-cron manual-trigger auth bypass
- **Area:** Authentication / Security
- **Detail:** Header `x-manual-trigger: true` skips the CRON_SECRET check entirely. Any unauthenticated caller can trigger invoice generation (and Stripe charges) for all/any school. Same pattern in billing-poe-cron and billing-queue-auto-approve.
- **Files:** `src/app/api/billing-invoice-cron/route.ts:49-65`
- **Recommendation:** In the manual branch still require a secret (x-manual-secret == CRON_SECRET or MANUAL_TRIGGER_SECRET); apply across all cron routes.

### TD-25 — AI draft publish has no conflict check — creates real double-bookings
- **Area:** Double-booking race condition
- **Detail:** The publish transaction inserts all draft events sequentially with no overlap query against existing/concurrently-published events. Two admins publishing overlapping drafts both succeed → double-booked aircraft/instructor/student. No unique constraint backstops it (idempotencyKey unused on this path).
- **Files:** `src/server/routes/routes-ai-schedule.ts:809` (also publish-selected:1288, outreach confirm:3613)
- **Recommendation:** Inside the transaction, query schedule_events for overlapping (instructorId/studentId/aircraftId × start/end) rows; reject/skip conflicts into the errors array.

### TD-26 — billing-invoice-cron idempotency: items before guard (partial Stripe charges)
- **Area:** Billing / Invoice Cron
- **Detail:** `generateInvoiceForSchool` creates Stripe invoice items before any local-invoice existence check; with no unique (flightSchoolId, periodStart) constraint, a retry/manual trigger creates duplicate Stripe items AND a duplicate local invoice.
- **Files:** `src/app/api/billing-invoice-cron/route.ts:291-353`
- **Recommendation:** Add a pre-flight SELECT for an existing invoice (school + billingMonth) and short-circuit; add idempotency keys to createInvoiceItem; consider a unique (flightSchoolId, periodStart) index.

### TD-27 — Engine Health: zero auth on all endpoints, unvalidated flightSchoolId from body
- **Area:** Authentication / Multi-tenant isolation
- **Detail:** None of the nine engine-health handlers call `requireAuth()`, and the router is mounted with no guard. Every POST/PUT reads flightSchoolId from the body and inserts with no session validation. Unauthenticated callers can read any aircraft's engine-health data and insert records against any school ID.
- **Files:** `src/server/routes/routes-engine-health.ts:102`
- **Recommendation:** Add `requireAuth()` to all nine handlers; replace body.flightSchoolId with the session-derived orgId verified against the equipment's school.

### TD-28 — Flight Schools CRUD: any user can list/create/update/delete any school
- **Area:** Multi-tenant isolation
- **Detail:** The five base /flight-schools CRUD endpoints use only `requireAuth()`; GET returns findAll() (all schools), POST/PUT/DELETE have no role/scope check.
- **Files:** `src/server/routes/routes-schools.ts:110`
- **Recommendation:** Restrict GET list to super_admin or scope to the caller's school; lock POST/PUT/DELETE to `requireSuperAdmin()`; add a session-school check on PUT.

## HIGH (deep scan)

### TD-29 — Admin Disputes: Adjust/Resubmit & Resolve send GET instead of PUT — never persist
- **Area:** Admin Sign-Off Management
- **Detail:** `handleAdjustAndResubmit` and `handleResolveDispute` build an updatePayload but pass only the URL to `fetchWithRetry`, which defaults to GET. The event is never mutated; UI optimistically updates while the DB is unchanged. `handleRevokeAutoSignoff` does it correctly.
- **Files:** `src/components/features/mvp-v2/components/admin-disputes-panel.tsx:327` (also :436)
- **Recommendation:** Pass `{ method:'PUT', headers: getServerApiHeaders(), credentials:'include', body: JSON.stringify(updatePayload) }` to both calls.

### TD-30 — stripe-webhook: dispute lifecycle events unhandled
- **Area:** Dispute Handling
- **Detail:** Only `charge.dispute.created` is handled; updated/closed/funds_withdrawn/funds_reinstated fall through to "unhandled". Won disputes leave invoice in 'disputed'/billingStatus 'Payment Failed'; lost disputes write no accounting entry. `void`/`uncollectible` also mis-map to 'overdue' on insert.
- **Files:** `src/app/api/stripe-webhook/route.ts:307-349`
- **Recommendation:** Add cases for the four dispute events (on won → revert status; on lost → write loss entry, mark uncollectible, notify).

### TD-31 — stripe-webhook: refund/void events unhandled
- **Area:** Refund / Void Handling
- **Detail:** No cases for charge.refunded, refund.created/updated, invoice.voided, invoice.marked_uncollectible. Refunded invoices stay 'paid', school stays 'Active', and no offsetting QB credit note is posted.
- **Files:** `src/app/api/stripe-webhook/route.ts:235-351`
- **Recommendation:** Handle charge.refunded (→'refunded' + QB credit memo), invoice.voided (→'void'), invoice.marked_uncollectible (→'uncollectible' + flag school).

### TD-32 — stripe-webhook: float string injected into SQL balance update (ACH precision loss)
- **Area:** Balance Accounting / Money Math
- **Detail:** `(updatedRow.amount/100).toFixed(4)` is string-interpolated into `COALESCE(balance,0) + ${deltaStr}`. amount is integer cents; balance is NUMERIC dollars. JS float artifacts and string-cast accumulation drift over ACH settlements.
- **Files:** `src/app/api/stripe-webhook/route.ts:621-625`
- **Recommendation:** Keep balance in integer cents and add `updatedRow.amount` as a typed numeric parameter, or use a Decimal type — not `.toFixed()` interpolation.

### TD-33 — stripe-webhook: inverted payment-method block logic
- **Area:** Payment Method Management
- **Detail:** `isNowBlocked = pm.blocked === true || previousAttributes.blocked === false`. The second clause flags a PM as blocked whenever its prior value was false — i.e. most update events incorrectly block the PM.
- **Files:** `src/app/api/stripe-webhook/route.ts:877-891`
- **Recommendation:** `isNowBlocked = pm.blocked === true && previousAttributes?.blocked !== true`.

### TD-34 — billing-invoice-cron: discount recomputed independently from net amount
- **Area:** Invoice Generation / Money Math
- **Detail:** amountCents rounds the discounted total; discountAmountCents rounds the discount from raw inputs separately. The two Math.round paths can differ by a cent, and the first Stripe line item posts the already-discounted amount while a separate discount line item double-applies the discount.
- **Files:** `src/app/api/billing-invoice-cron/route.ts:246-308`
- **Recommendation:** Compute `discountAmountCents = gross - discounted` once and reuse for both the Stripe line item and the local record.

### TD-35 — Feature Flags resolve: any user can read any school's flags (IDOR)
- **Area:** Multi-tenant isolation
- **Detail:** GET /feature-flags/resolve/:flagKey accepts a client `orgId` query param and uses it directly with no ownership check.
- **Files:** `src/server/routes/routes-feature-flags.ts:133`
- **Recommendation:** If orgId is supplied and caller is not super_admin, 403 unless it equals the session-resolved orgId.

### TD-36 — Feature Flags override: admin can write flags for any school
- **Area:** Multi-tenant isolation
- **Detail:** POST/DELETE /feature-flags/override take `orgId` from the body behind `requireAdmin()` with no tenant check, so any admin can set overrides for an arbitrary school.
- **Files:** `src/server/routes/routes-feature-flags.ts:351`
- **Recommendation:** After auth, resolve session orgId and 403 if body.orgId differs and role !== super_admin.

### TD-37 — SMS routes: admin can read logs / send SMS for any school
- **Area:** Multi-tenant isolation
- **Detail:** GET /schools/:schoolId/sms/logs and POST .../sms/send use `requireAdmin()` with no session-vs-:schoolId comparison. A plain admin can read another school's SMS logs or send on its Twilio account.
- **Files:** `src/server/routes/routes-sms.ts:30`
- **Recommendation:** After admin check, resolve orgId and 403 if it != :schoolId (super_admin exempt).

### TD-38 — Nullable session guard bypasses tenant isolation across 39 sites
- **Area:** Multi-tenant isolation
- **Detail:** Pattern `if (userSchoolId && userSchoolId !== orgId) 403` skips the check when `resolveOrgIdFromSession` returns null (user not in users/teamMembers). A valid Better Auth session with no app-level org passes any orgId.
- **Files:** `src/server/routes/routes-squawks.ts:383` (+ routes-calibration-log.ts, routes-maintenance-discrepancies.ts, routes-wo-discrepancies.ts; 39 occurrences)
- **Recommendation:** Change to `if (!userSchoolId || userSchoolId !== orgId) 403`; exempt super_admin explicitly; apply to all 39.

### TD-39 — Storage: equipment photo upload/delete has no tenant ownership check
- **Area:** Multi-tenant isolation
- **Detail:** Upload accepts arbitrary `equipmentId` and writes to S3 with no school check; delete accepts an unconstrained `storagePath` and deletes it directly — any user can delete any object in the bucket.
- **Files:** `src/server/routes/routes-storage.ts:292` (delete:348)
- **Recommendation:** On upload, look up the equipment's school and compare to session orgId; on delete, validate the path prefix matches `equipment-photos/{equipmentId}/` owned by the caller's school.

### TD-40 — Maintenance Intelligence: schoolId from URL param, no ownership check
- **Area:** Multi-tenant isolation
- **Detail:** All three endpoints use only `requireAuth()` and never resolve the session user; any user can pass any schoolId UUID and receive equipment, maintenance, work-order, and AI analytics for any school.
- **Files:** `src/server/routes/routes-maintenance-intelligence.ts:207` (also 385, 632)
- **Recommendation:** `resolveOrgIdFromSession` and enforce orgId === schoolId || super_admin before any query.

### TD-41 — Work Orders: orgId from query string, no session validation (IDOR)
- **Area:** Multi-tenant isolation
- **Detail:** GET /work-orders and /:id (and mutations) take orgId from the query string and use it in the WHERE clause; `resolveOrgIdFromSession` is never called. Any user can read/modify any org's work orders.
- **Files:** `src/server/routes/routes-work-orders.ts:310`
- **Recommendation:** Remove the orgId query param; derive from session; apply to POST/PATCH/DELETE too.

### TD-42 — Parts Catalog: orgId from query string, no session validation (IDOR)
- **Area:** Multi-tenant isolation
- **Detail:** All parts routes take orgId from the query string and never read authUser; any user can read/create/update/delete another org's parts.
- **Files:** `src/server/routes/routes-parts.ts:88`
- **Recommendation:** Replace query-param orgId with `resolveOrgIdFromSession`; 403 on null; apply to GET/POST/PATCH/DELETE and /:id/transactions.

### TD-43 — Part Installations: orgId from query string, no session validation (IDOR)
- **Area:** Multi-tenant isolation
- **Detail:** All six endpoints accept orgId from query/body and scope queries by it with no session cross-check; never imports `resolveOrgIdFromSession`.
- **Files:** `src/server/routes/routes-part-installations.ts:74`
- **Recommendation:** Resolve orgId from session in every handler; remove the orgId param; update clients accordingly.

### TD-44 — AD/SB fleet-summary: no org check — any user can read any school's fleet AD posture
- **Area:** AD/SB Enforcement
- **Detail:** GET /ads-sbs/fleet-summary/:schoolId (and /:equipmentId, PUT/DELETE, signoff) use only `requireAuth()` with no orgId comparison against :schoolId.
- **Files:** `src/server/routes/routes-ads-sbs.ts:247-429`
- **Recommendation:** `resolveOrgIdFromSession` and verify it matches :schoolId before querying; apply across the AD/SB routes.

### TD-45 — Stored XSS in help-article markdown rendered with dangerouslySetInnerHTML
- **Area:** XSS / Content Security
- **Detail:** Code-block regex uses raw `$2`, so HTML inside a fenced block (e.g. `</code><img onerror=…>`) is injected. Article writes are behind `requireAuth()` only, so any user can author content. super-admin-help.tsx:296 has the same link-href issue.
- **Files:** `src/components/features/mvp-v2/pages/help.tsx:126`
- **Recommendation:** DOMPurify.sanitize(html) after markdown conversion; restrict help-article writes to `requireAdmin()`/`requireSuperAdmin()`.

### TD-46 — IDOR: /create-setup-intent doesn't verify caller's school
- **Area:** Authorization / IDOR
- **Detail:** studentId comes from the body with no check that the caller's school matches the student's flightSchoolId; a user can obtain a Stripe SetupIntent client_secret for any student.
- **Files:** `src/server/routes/routes-stripe.ts:407`
- **Recommendation:** Assert `orgId === user.flightSchoolId` (resolved from session) before any Stripe call; gate cross-student billing reads behind `requireAdmin()`.

### TD-47 — IDOR: /stripe/customers/details & /student lack school ownership check
- **Area:** Authorization / IDOR
- **Detail:** Both endpoints fetch the student by id and return Stripe customer ID/metadata/charge history with no school comparison; any user can read another school's student billing data.
- **Files:** `src/server/routes/routes-stripe.ts:612` (also 743)
- **Recommendation:** After loading the student, 403 unless session orgId === user.flightSchoolId (super_admin via managedSchoolId allowed).

### TD-48 — SSRF via redirect-following in proxy-image (domain-only allowlist)
- **Area:** SSRF
- **Detail:** Allowlist is checked only on the initial URL; `redirect:'follow'` means a 3xx from an allowed CDN to an internal address (e.g. 169.254.169.254) is followed. Route also has no auth.
- **Files:** `src/app/api/proxy-image/route.ts:94`
- **Recommendation:** Use `redirect:'manual'`, re-validate the Location header against the allowlist before re-fetching; add `requireAuth()`.

### TD-49 — Brute-force exposure on /api/auth/sign-in/email
- **Area:** Rate Limiting / Authentication
- **Detail:** Sign-in falls into the generic unauthenticated tier (60/60s per IP) with no per-email throttle, lockout, or CAPTCHA; IP rotation enables credential stuffing. (Related to TD-13's partial rate-limit coverage.)
- **Files:** `src/proxy.ts:173`
- **Recommendation:** Add a dedicated tighter `auth` tier (~10/60s) per IP and per email; enable Better Auth's rateLimit plugin; Redis-backed per-email counter on failed logins.

### TD-50 — CSP allows unsafe-inline — no XSS mitigation
- **Area:** XSS / Content Security Policy
- **Detail:** script-src/script-src-elem/style-src all include 'unsafe-inline' (script-src also 'unsafe-eval'), so any injected inline script executes. Combined with the dangerouslySetInnerHTML vectors this leaves XSS unmitigated.
- **Files:** `src/proxy.ts:110`
- **Recommendation:** Move to a per-request nonce (Next.js middleware) and drop 'unsafe-inline'/'unsafe-eval'.

### TD-51 — BETTER_AUTH_SECRET not validated at startup
- **Area:** Authentication / Configuration
- **Detail:** `secret: process.env.BETTER_AUTH_SECRET` passed with no guard; if absent, Better Auth may use a weak default or fail late at first request.
- **Files:** `src/lib/auth.ts:42`
- **Recommendation:** Throw at module init in production if the env var is missing, so cold start fails fast.

### TD-52 — E2E auth bypass keyed only on NODE_ENV with a hardcoded default secret
- **Area:** Authentication / Test Bypass
- **Detail:** Bypass enabled when `E2E_AUTH_BYPASS=true && NODE_ENV!=='production'`, with a public hardcoded default secret. A Vercel preview (NODE_ENV development/test) lets anyone who knows the default secret impersonate super_admin. (Extends TD-03 with the VERCEL_ENV gap.)
- **Files:** `src/lib/e2e-auth-bypass.ts:26`
- **Recommendation:** Also disable when `VERCEL_ENV` is set; reject the default secret on any non-local URL; remove the hardcoded fallback.

### TD-53 — help-route article mutations behind requireAuth() not requireAdmin()
- **Area:** Authorization
- **Detail:** All help category/article create/update/delete/publish/duplicate endpoints use bare `requireAuth()`; any authenticated user can author content later rendered with dangerouslySetInnerHTML (compounds TD-45).
- **Files:** `src/server/routes/routes-help.ts:174`
- **Recommendation:** Replace `requireAuth()` with `requireSuperAdmin()` on every mutating help endpoint.

### TD-54 — Unescaped regex capture groups in AI markdown renderer (XSS)
- **Area:** XSS / Input Validation
- **Detail:** `$2` capture-group substitution injects raw AI/DB content into HTML (`</code><script>…`). Same pattern in help.tsx:86 and super-admin-help.tsx:256; output goes to dangerouslySetInnerHTML.
- **Files:** `src/components/features/mvp-v2/components/hilo-ai-drawer.tsx:33`
- **Recommendation:** HTML-escape every capture group before substitution in all renderMarkdown/MarkdownContent functions.

### TD-55 — occupancyMap keyed on UTC date, not location-local date (double-booking)
- **Area:** Scheduler conflict detection
- **Detail:** `s.toISOString().split('T')[0]` buckets occupancy by UTC date. A Hawaii evening event lands in the next UTC day's bucket, so the solver sees no conflict on the relevant local day and double-books.
- **Files:** `src/server/routes/routes-ai-schedule.ts:2129`
- **Recommendation:** Key occupancyMap by the location-local date (Intl/toLocaleString with the location timezone), matching the scheduling loop.

### TD-56 — Weekly outreach confirm: no transaction, no conflict check, non-atomic status guard
- **Area:** Double-booking race condition
- **Detail:** Status checked 'pending' then events inserted sequentially outside a transaction; concurrent confirms race past the guard and duplicate all events (idempotencyKey not populated). No overlap check.
- **Files:** `src/server/routes/routes-ai-schedule.ts:3600`
- **Recommendation:** Wrap status update + inserts in one transaction with a row lock (FOR UPDATE) on the outreach record; add overlap checks.

### TD-57 — Dispatch riskScore stored from client without server re-computation
- **Area:** Dispatch assessment correctness
- **Detail:** The POST handler stores `body.riskScore`/`riskLevel` verbatim; `assessDispatchRisk()` is never called on the student dispatch path. Instructors see a student-spoofable risk score.
- **Files:** `src/server/routes/routes-locations.ts:27429`
- **Recommendation:** Re-run `assessDispatchRisk()` server-side and override riskScore/riskLevel on insert; reject submissions with blocking conditions.

### TD-58 — scoreWeightBalance hardcodes C172 MTOW/CG limits for all aircraft
- **Area:** Dispatch assessment correctness
- **Detail:** Uses fixed 2300/2550 lb MTOW and 37–45 CG envelope, wrong for any non-C172 (e.g. Piper Cherokee CG ~84–95 in). Misses overweight conditions and false-flags legal CG.
- **Files:** `src/lib/dispatch/dispatch-assessment.ts:638`
- **Recommendation:** Accept per-aircraft maxGrossWeight/cgFwdLimit/cgAftLimit in the payload; fall back to defaults only when no profile exists.

### TD-59 — nextDiscNumber uses COUNT instead of MAX — duplicate DISC numbers under concurrency
- **Area:** Maintenance Discrepancies
- **Detail:** COUNT(*) over the current year (no soft-delete exclusion) generates colliding DISC numbers under concurrent requests or after deletes; routes-squawks.ts uses the correct MAX-based pattern.
- **Files:** `src/server/routes/routes-maintenance-discrepancies.ts:59-73`
- **Recommendation:** Adopt the MAX(disc_number) implementation from squawks plus onConflictDoNothing()/retry on insert.

### TD-60 — Consolidate WO doesn't move workOrderSquawks junction rows
- **Area:** Work Order State Machine / Squawk Wiring
- **Detail:** Consolidate re-parents maintenanceDiscrepancies to the target WO but leaves work_order_squawks rows pointing at the voided source; on target completion those squawks are never resolved. squawks.linkedWorkOrderId also stays on the source.
- **Files:** `src/server/routes/routes-work-orders.ts:2808-2847`
- **Recommendation:** UPDATE work_order_squawks SET work_order_id = target WHERE work_order_id = source; UPDATE squawks SET linked_work_order_id = target likewise.

### TD-61 — PATCH /work-orders/:id complete path doesn't close linked discrepancies
- **Area:** Work Order State Machine / Squawk Wiring
- **Detail:** The PATCH /status 'complete' branch resolves squawks but, unlike POST /complete (step 7), never closes linked maintenance_discrepancies. Since pending_inspection→complete is a valid PATCH transition, discrepancies stay 'open'/'pending_signoff'.
- **Files:** `src/server/routes/routes-work-orders.ts:2558-2598`
- **Recommendation:** In the PATCH 'complete' transaction, close discrepancies with resolvedDuringWoId = workOrderId, mirroring POST /complete step 7.

### TD-62 — AD/SB compliance ignores tach time for tach-tracked aircraft
- **Area:** AD/SB Enforcement
- **Detail:** computeAdStatus receives only currentHobbs and stores nextDueHobbs from hobbs; tach-tracked aircraft (the common piston case) show 'compliant' while overdue on tach.
- **Files:** `src/server/routes/routes-ads-sbs.ts:209-235`
- **Recommendation:** Add currentTach + a tach-based threshold; pass both hobbs and tach from fleet-summary and per-aircraft endpoints; store meterType on the signoff.

### TD-63 — Part installation aircraft-hours snapshot taken at add-time, not WO completion
- **Area:** Part Installations / Part Hours Tracking
- **Detail:** aircraftHours is captured when the part is added to the WO and never updated at completion when final hobbs/tach are written, so life-limited part remaining-hours calculations are offset.
- **Files:** `src/server/routes/routes-work-orders.ts:1883-1895`
- **Recommendation:** In POST /complete after updating aircraft hours, update part_installations.aircraftHours for the WO, or expose it as editable at signoff.

### TD-64 — Defer endpoint writes Better Auth ID into a UUID FK column
- **Area:** WO Discrepancies
- **Detail:** `deferredByUserId: authUser.id` writes the Better Auth nanoid into a uuid FK to users.id; the sibling resolve endpoint correctly calls `resolveHiloUserIdFromEmail`. Every defer is a runtime FK violation.
- **Files:** `src/server/routes/routes-wo-discrepancies.ts:629-639`
- **Recommendation:** Resolve the application users.id via email and use it for deferredByUserId.

### TD-65 — enrolledCount increment-only — counter drifts permanently
- **Area:** LMS / Enrollment state
- **Detail:** incrementEnrolledCount runs on enroll but there is no unenroll endpoint or decrement; /lms/stats totalEnrollments sums the denormalized counter, so it always overstates.
- **Files:** `src/server/routes/routes-lms.ts:969`
- **Recommendation:** Add an unenroll endpoint that deletes the enrollment row and decrements the counter (max(0) guard).

### TD-66 — /lms/student-progress quadratic N+1
- **Area:** LMS / Performance
- **Detail:** Nested loops issue 1 + N + N×M queries (enrollments per course, then progress per student per course) — ~511 queries for 10 courses × 50 students.
- **Files:** `src/server/routes/routes-lms.ts:1227`
- **Recommendation:** Two bulk queries (all enrollments, all progress) assembled in JS; same restructure for findGuideAssignmentsByStudent progress at :1383.

### TD-67 — Guide-assignment complete sets completedAt=null
- **Area:** LMS / Guide Assignments
- **Detail:** `updateGuideAssignmentStatus(id,'completed')` omits the third arg so the repo writes `completedAt: null`; the UI later reads completedAt and shows nothing.
- **Files:** `src/server/routes/routes-lms.ts:1585`
- **Recommendation:** Pass `new Date()` as the third arg; guard against re-completing.

### TD-68 — Assignment enforcement bypass: findBlockingIncomplete drops 'submitted'
- **Area:** Assignments / Enforcement
- **Detail:** The query returns all needsReview rows; the route filters client-side to not_started/in_progress, so a submitted-but-ungraded blocking assignment does NOT block dispatch — a stage-gate bypass.
- **Files:** `src/repositories/mvp-v2.repository.impl.ts:12723`
- **Recommendation:** Filter `status IN ('not_started','in_progress','submitted')` at the DB level and keep 'submitted' as blocking.

### TD-69 — Student status reorder endpoint doesn't validate ownership
- **Area:** Student Settings
- **Detail:** PUT .../statuses/reorder updates rows by id only with no locationId predicate; a user can reorder another location/school's statuses. Same in reorderCustomFields.
- **Files:** `src/server/routes/routes-students.ts:126`
- **Recommendation:** Add `and(eq(table.id, u.id), eq(table.locationId, locationId))` (or a pre-flight ownership check) in both reorder methods.

### TD-70 — schedule.ts service functions call non-existent endpoints
- **Area:** Schedule Service
- **Detail:** All schedule-service mutations target `/api/server/schedule…` paths that don't exist; dead code with a broken contract. (Cross-ref: broken-functionality BF-32.)
- **Files:** `src/components/features/mvp-v2/services/schedule.ts:94`
- **Recommendation:** Delete the service or rewrite to the real `/locations/:locationId/schedule` contract.

### TD-71 — POST /work-orders/:id/parts stock check not atomic with deduction (race → negative stock)
- **Area:** Work Orders / Parts
- **Detail:** qtyOnHand is read before the transaction; two concurrent adds both pass the guard and decrement from the same stale value. No DB CHECK (qty_on_hand >= 0).
- **Files:** `src/server/routes/routes-work-orders.ts:1871-1933`
- **Recommendation:** Move the guard inside the transaction with an optimistic update: `UPDATE … SET qty_on_hand = qty_on_hand - $qty WHERE id=$id AND qty_on_hand >= $qty RETURNING id`.

### TD-72 — LMS guide-assignments/alerts: any user can read any school's student alert flags
- **Area:** Multi-tenant isolation
- **Detail:** GET /lms/guide-assignments/alerts uses bare `requireAuth()` and reads flightSchoolId from the query string with no session check.
- **Files:** `src/server/routes/routes-lms.ts:1554`
- **Recommendation:** Use `resolveOrgIdFromSession`; 403 on null/mismatch (the sibling at-risk endpoint needs the session comparison too).

### TD-73 — automations-cron checkStudentInactivity N+1, no batch cap
- **Area:** Automations Cron
- **Detail:** Per-student loop issues 4+ sequential queries plus a workflow trigger; 500 students ≈ 2500 sequential queries in a single ≤300s function → timeouts and partial runs.
- **Files:** `src/app/api/automations-cron/route.ts:171-286`
- **Recommendation:** Batch the sub-queries into joins; add a LIMIT + cursor or fan out per-location to Inngest.

### TD-74 — workflowRunner swallows node failures and continues traversal
- **Area:** Inngest / Workflow Runner
- **Detail:** A thrown action node is caught/logged but downstream nodes still run with proceed:true; the execution is marked 'completed', not 'failed'.
- **Files:** `src/lib/inngest/functions/workflowRunner.ts:234-248`
- **Recommendation:** On failure, push downstream with proceed:false (per node config) and mark the execution 'partial_failure'.

### TD-75 — workflowFailureNotifier no idempotency — duplicate admin emails on retry
- **Area:** Inngest / Failure Notifier
- **Detail:** retries:2 with a plain email loop and no per-recipient checkpoint or sent-record; a transient failure re-sends to all admins.
- **Files:** `src/lib/inngest/functions/workflowFailureNotifier.ts:8-62`
- **Recommendation:** Wrap each send in `step.run('send-email-{email}')` or persist a (executionId, adminEmail) sent record and skip duplicates.

### TD-76 — automation-scheduler cron has no distributed lock (double-fire) + dead idempotency guard
- **Area:** Automation Scheduler Cron
- **Detail:** Plain SELECT of due schedules then send + advance; concurrent invocations double-fire. The Inngest idempotencyKey is in event.data (not the event id) and workflowExecutions has no unique index on idempotency_key, so the DB guard is dead code.
- **Files:** `src/app/api/cron/automation-scheduler/route.ts:15-136`
- **Recommendation:** Atomic claim (`UPDATE … SET next_run_at=$next WHERE id=$id AND next_run_at=$orig RETURNING id`, send only if a row returned), or SELECT FOR UPDATE SKIP LOCKED; add the unique index.

### TD-77 — billing-queue-auto-approve processes all overdue invoices in one Promise.all (no cap)
- **Area:** Billing Queue Auto-Approve Cron
- **Detail:** findOverdueForAutoApprove has no LIMIT; all results run concurrently (two DB writes each + a trigger loop), risking connection-pool stampede and maxDuration timeout with partial completion.
- **Files:** `src/app/api/billing-queue-auto-approve/route.ts:90-185`
- **Recommendation:** Chunk (e.g. 50) and process sequentially or use p-limit; add a LIMIT + cursor.

### TD-78 — contract-reminder-cron only console.logs — no notifications delivered
- **Area:** Contract Reminder Cron
- **Detail:** All 60/30/7-day reminders only console.log; the implemented `sendContractRenewalReminderEmail()` is never imported/called. Schools approaching renewal are silently unnotified.
- **Files:** `src/app/api/contract-reminder-cron/route.ts:82-104`
- **Recommendation:** Wire the cron to sendContractRenewalReminderEmail() (the email infra already exists), or disable the cron until wired.

### TD-79 — routes-assignments POST passes raw body to repository.create (mass assignment)
- **Area:** Input Validation
- **Detail:** Raw body cast to Record<string,unknown> and spread into the insert; a caller can inject status:'graded', gradedById, score, etc. Only studentId/locationId/flightSchoolId are overridden.
- **Files:** `src/server/routes/routes-assignments.ts:141`
- **Recommendation:** Build the insert from an explicit writable-field allowlist (Zod or manual extraction); never spread the raw body.

### TD-80 — routes-squawks POST leaks raw DB error messages in HTTP body
- **Area:** Error Handling
- **Detail:** `safeError(err)` returns err.message verbatim into the 500 body (table/column/constraint/SQL fragments) on an authenticated route — the only handler in the file that does so.
- **Files:** `src/server/routes/routes-squawks.ts:557`
- **Recommendation:** Return a static message (consistent with the other handlers) or `formatErrorForUser(...)`; log full detail server-side only.

### TD-81 — Feature Flags: any user can read any school's flag config (already noted; cross-ref TD-35)
- **Area:** Multi-tenant isolation
- **Detail:** Read path on the flag registry/resolve also exposed to any authenticated user via the client-supplied orgId; tracked with TD-35.
- **Files:** `src/server/routes/routes-feature-flags.ts:133`
- **Recommendation:** See TD-35 — enforce session-orgId match for non-super-admins.

### TD-82 — schedule_events missing index on flightSchoolId for tenant scans
- **Area:** Scheduling / Performance
- **Detail:** Only a unique (flightSchoolId, idempotencyKey) index leads with flightSchoolId; school-wide queries (fetchSchoolData, dashboard with no locationId) do full-table scans as event count grows.
- **Files:** `src/lib/schema/index.ts:1020-1045`
- **Recommendation:** Add `index('schedule_events_school_start_idx').on(flightSchoolId, startAt)`.

### TD-83 — userIntegrations uses index() not uniqueIndex() for (userId, integrationType)
- **Area:** User Integrations
- **Detail:** The index named `..._unique` is a plain index; duplicate token rows for the same user/integration can be inserted. A redundant second plain index covers the same columns.
- **Files:** `src/lib/schema/index.ts:2851-2855`
- **Recommendation:** Change to `uniqueIndex(...)`; remove the redundant plain index.

### TD-84 — qb_entity_map missing FK + missing unique constraint
- **Area:** QuickBooks Integration
- **Detail:** flightSchoolId has no `.references()` (orphan rows after school delete). The "composite unique" ATOS/QB indexes are plain `index()` not `uniqueIndex()`, so duplicate ATOS→QB mappings can corrupt the SyncToken chain and cause duplicate invoices.
- **Files:** `src/lib/schema/quickbooks.ts:80`, `:90-102`
- **Recommendation:** Add `.references(() => flightSchools.id, { onDelete:'cascade' })`; change both entity indexes to `uniqueIndex(...)` and generate a migration.

## MEDIUM (deep scan)

### TD-85 — Expiring Currencies "Notify" Bell button has no onClick
- **Area:** Dashboard — Expiring Currencies Widget
- **Detail:** The Bell button is styled as an action with hover state but has no onClick; the row only wires onNavigate to the profile button.
- **Files:** `src/components/features/mvp-v2/components/dashboard-widgets/expiring-currencies-widget.tsx:100`
- **Recommendation:** Wire onClick to a notify endpoint / compose-message drawer, or render disabled with a tooltip until implemented.

### TD-86 — Dashboard Checkride Queue / Assignments Due rows are non-interactive divs
- **Area:** Dashboard widgets
- **Detail:** Each row is a plain div with no onClick/useNavigate, unlike WidgetMaintenanceAlerts/WidgetAtRiskStudents which navigate on click. (Assignments Due also needs studentId surfaced by the API.)
- **Files:** `src/components/features/mvp-v2/components/dashboard/widget-checkride-queue.tsx:83`; `widget-assignments-due.tsx:86`
- **Recommendation:** Convert rows to buttons that navigate to the checkride/student detail; expose studentId in the API responses.

### TD-87 — Stage Check scheduling buttons hardcode disabled={false}
- **Area:** Stage Check Scheduling
- **Detail:** Ineligible stage buttons are visually greyed (opacity-60) but `disabled={false}` is hardcoded, misrepresenting state to a11y tooling. (Functional guard is intact via the override dialog.)
- **Files:** `src/components/features/mvp-v2/components/stage-check-scheduling-drawer.tsx:490`
- **Recommendation:** Use `disabled={!canSelect}` while keeping the override dialog handler.

### TD-88 — hilo-stripe-billing-service: insertStripeMapping runs outside withTransaction
- **Area:** Invoice Generation / Transaction Safety
- **Detail:** The status update + audit log are transactional but insertStripeMapping commits separately; a crash between leaves STRIPE_INVOICED with no mapping row (QB sync falls back to a slower path).
- **Files:** `src/server/accounting/hilo-stripe-billing-service.ts:329-356`
- **Recommendation:** Call insertStripeMapping inside the withTransaction callback, passing the tx handle.

### TD-89 — hap-billing-calculator: float percentage multiplication drifts a cent
- **Area:** Money Math / Fee Calculation
- **Detail:** `Math.round((total * percentage)/100)` with float percentages like 2.85 systematically rounds down (e.g. $1000 → 2849 instead of 2850).
- **Files:** `src/server/accounting/hap-billing-calculator.ts:246-251`
- **Recommendation:** Store cardPercentage as integer basis points; `Math.round(total * bps / 10000) + fixedCents`.

### TD-90 — billing-queue-auto-approve: balance/status updates not atomic with event flag
- **Area:** Auto-Approval / Transaction Safety
- **Detail:** updateWithBalanceAdjust is transactional internally, but the scheduleEvents flag update is a separate call; a crash between leaves the invoice approved/balance debited with studentAutoSignedOff=false.
- **Files:** `src/app/api/billing-queue-auto-approve/route.ts:90-185`
- **Recommendation:** Wrap both the invoice update and the event flag update in a single transaction.

### TD-91 — stripe-webhook: concurrent SetupIntents can set two default payment methods
- **Area:** Payment Method Management / Race Condition
- **Detail:** existingMethods read outside a transaction; two concurrent SetupIntents both see length 0 and both insert isDefault:true. No partial unique index.
- **Files:** `src/app/api/stripe-webhook/route.ts:463-479`
- **Recommendation:** Add a partial unique index on schoolPaymentMethods(flightSchoolId) WHERE isDefault, or do the check inside a transaction with row lock.

### TD-92 — qbInvoiceMapper: DocNumber slice(0,21) before throw — dead guard + 1-char truncation
- **Area:** QB Sync / Code Correctness
- **Detail:** `.slice(0,21)` runs before the `if (length > 21) throw`, so the throw is unreachable; the 22-char `invoice-YYMMDDHHMM-XXX` format is silently truncated by one char.
- **Files:** `src/services/quickbooks/qbInvoiceMapper.ts:91-95`
- **Recommendation:** Build the string, throw if > 21 (no slice), then return.

### TD-93 — Unauthenticated Places API proxy (key abuse)
- **Area:** Authentication / Authorization
- **Detail:** /places/autocomplete and /places/details have no `requireAuth()` and proxy billable Google Places calls. (Weather routes hit free FAA AWC — no financial risk there.) (Cross-ref TD-16.)
- **Files:** `src/server/routes/routes-places.ts` (cf. routes-weather.ts:225)
- **Recommendation:** Add `requireAuth()` to the two Places routes.

### TD-94 — Maintenance discrepancies em-sync dedupes by title — phantom duplicates / skips
- **Area:** Maintenance Discrepancies
- **Detail:** Step 2 em-sync matches existing discrepancies by title+equipment only and never sets linkedSquawkId, so two same-title squawks on one aircraft collapse to one, and a soft-deleted discrepancy lets a second be created alongside it.
- **Files:** `src/server/routes/routes-maintenance-discrepancies.ts:260-277`
- **Recommendation:** Match by linkedSquawkId (em.id) before falling back to title; set linkedSquawkId on insert.

### TD-95 — AI curriculum incremental publish allows partially-approved/sparse stages
- **Area:** AI Curriculum / Incremental Builder
- **Detail:** Publish only checks approvedStages.length > 0, not == totalStages, and sparse-array index writes can leave undefined slots; a 4-stage build publishes a 2-stage curriculum silently.
- **Files:** `src/server/routes/routes-ai-curriculum-incremental.ts:773`
- **Recommendation:** Require approvedStages.filter(Boolean).length === totalStages before publishing; filter sparse slots.

### TD-96 — GET /lms/courses/:courseId/questions N+1 title lookups
- **Area:** LMS / Performance
- **Detail:** Maps over questions firing per-row findCourseTitleById/findLessonTitleById (up to 2N queries); the /lms/questions endpoint already uses a JOIN.
- **Files:** `src/server/routes/routes-lms.ts:671`
- **Recommendation:** Use a JOIN-based query (like findQuestionsWithJoin) or two IN lookups on unique ids.

### TD-97 — AI curriculum Inngest builder marks truncated output 'completed'
- **Area:** AI Curriculum / Builder
- **Detail:** wasTruncated is returned but the mark-complete step always sets status='completed' and stores the truncated curriculum; only an advisory banner (no save gate) protects the admin.
- **Files:** `src/lib/inngest/functions/curriculumBuilder.ts:188`
- **Recommendation:** Set status='completed_truncated' on truncation, surface a warning via the poll endpoint, and gate save.

### TD-98 — findGuideAssignmentsByStudent has no flightSchoolId filter
- **Area:** LMS / Multi-tenancy
- **Detail:** Queries by studentId only; the route is `requireAuth()` with no tenant scoping, so a guessed studentId UUID returns another school's guide assignments.
- **Files:** `src/repositories/mvp-v2.repository.impl.ts:6693`
- **Recommendation:** Add orgId param + `eq(table.flightSchoolId, orgId)`; pass the session orgId from the route.

### TD-99 — Date-range iteration uses bare local-time Date construction
- **Area:** Timezone / UTC conversion
- **Detail:** `new Date('YYYY-MM-DDT00:00:00')` is parsed as server-local time then toISOString'd; a non-UTC server east of GMT produces wrong date strings / day-of-week. Same at the existing-events endpoint :353.
- **Files:** `src/server/routes/routes-ai-schedule.ts:2273`
- **Recommendation:** Construct with explicit `Z` and compute day-of-week against the location timezone.

### TD-100 — AI solver occupancy check is in-memory only — concurrent solves not isolated
- **Area:** Scheduler conflict detection
- **Detail:** Both /generate calls load existingDbEvents and track new slots in request-local maps; concurrent solves produce independently-publishable conflicting drafts with no cross-request guard.
- **Files:** `src/server/routes/routes-ai-schedule.ts:2314`
- **Recommendation:** Enforce single-active-draft per location, add a partial unique constraint on (instructor/aircraft, startAt), or re-check occupancy inside the publish transaction.

### TD-101 — PATCH /work-orders/:id always resets actualStartAt on in_progress
- **Area:** Work Order State Machine
- **Detail:** Every transition to in_progress sets actualStartAt=now, so an awaiting_parts→in_progress re-entry overwrites the original start timestamp.
- **Files:** `src/server/routes/routes-work-orders.ts:2549-2551`
- **Recommendation:** Select current actualStartAt and only set it when null.

### TD-102 — DELETE (void) WO releases squawks to 'open' but leaves linkedWorkOrderId set
- **Area:** Work Order State Machine / Squawk Wiring
- **Detail:** Void resets squawk status but not linkedWorkOrderId (the hard/soft delete paths clear it); stale FK persists, masked by dashboard filters.
- **Files:** `src/server/routes/routes-work-orders.ts:1120-1130`
- **Recommendation:** Also set linkedWorkOrderId=null in the void handler.

### TD-103 — PATCH /work-orders/:id allows changing equipmentId after parts issued
- **Area:** Work Order State Machine
- **Detail:** equipmentId is patchable with no guard; reassigning a WO's aircraft after part_installations exist orphans those records on the original aircraft.
- **Files:** `src/server/routes/routes-work-orders.ts:1003-1044`
- **Recommendation:** Reject the change (422) when parts/time logs exist, or migrate part_installations to the new aircraftId atomically.

### TD-104 — Aircraft logbook hoursUntil100hr uses logbook entries, not live equipment hours
- **Area:** Aircraft Logbook
- **Detail:** Uses latestEntry.aircraftTotalTime as 'current' so the metric freezes between entries; equipment.hobbsTime/totalHours are fetched but unused. Returns null if the 100-hr was done via a WO.
- **Files:** `src/server/routes/routes-aircraft-logbook.ts:221-249`
- **Recommendation:** Use live aircraft.hobbsTime/totalHours as currentTotalTime.

### TD-105 — instructor-weekly-outreach: no Sentry monitor, always returns 200
- **Area:** Instructor Weekly Outreach Cron
- **Detail:** No Sentry.withMonitor/captureException and returns 200 even when every location failed; monitoring reports it perpetually healthy.
- **Files:** `src/app/api/instructor-weekly-outreach/route.ts:42-182`
- **Recommendation:** Wrap in Sentry.withMonitor; captureException in catch blocks; return 207/500 on errors.

### TD-106 — automations-cron always returns 200 on partial failure
- **Area:** Automations Cron
- **Detail:** Sub-check errors are appended to results.errors but the handler returns 200/'ok'; Sentry/Vercel never surface failures. maxRuntime:5 / checkinMargin:2 are unrealistic for a multi-minute job.
- **Files:** `src/app/api/automations-cron/route.ts:114-126`
- **Recommendation:** Return 207 when errors exist; captureException per sub-check; raise maxRuntime.

### TD-107 — frcAssessmentRun in-memory accumulators reset on Inngest retry
- **Area:** Inngest / FRC Assessment Run
- **Detail:** runningScoreSum/rulesTriggeredAcrossBatch are mutated inside step.run but live in outer scope; memoized steps don't replay the mutations on retry, so steps 6/7 write understated averages/counts.
- **Files:** `src/lib/inngest/functions/frcAssessmentRun.ts:190-323`
- **Recommendation:** Compute aggregates in a dedicated step that re-reads persisted frcTestResults rows, not from in-memory accumulators.

### TD-108 — fetchStandbyByDate sends browser tz offset; server applies it to UTC midnight
- **Area:** Timezone / standby
- **Detail:** Client sends getTimezoneOffset(); the server adds it to UTC midnight, so a cross-timezone admin gets day boundaries off by the offset difference. Same in the main schedule endpoint :17587.
- **Files:** `src/components/features/mvp-v2/services/standby.ts:101`
- **Recommendation:** Deprecate tzOffset; derive day boundaries from the location's stored IANA timezone (date-fns-tz), as the solver's getOpHoursForDay already does.

### TD-109 — Custom field delete returns 200 even when the ID doesn't exist
- **Area:** Student Settings
- **Detail:** deleteCustomField issues DELETE without checking rowCount and always returns {ok:true}; deleting an arbitrary UUID "succeeds".
- **Files:** `src/server/routes/routes-students.ts:428`
- **Recommendation:** Use .returning() and 404 when no row was deleted (cf. deleteStatus).

### TD-110 — hilo-university GET /categories: unfiltered progress scan (N+1)
- **Area:** Hilo University / Performance
- **Detail:** Per category, fetches all of the user's lesson-progress rows then filters in JS; inArray is already used correctly in the sibling endpoint.
- **Files:** `src/server/routes/routes-hilo-university.ts:100`
- **Recommendation:** Add `inArray(lessonProgress.lessonId, lessonIds)` to the WHERE (guard length>0); hoist the fetch out of the map and use a Set.

### TD-111 — Inconsistent 500 error shape across squawks vs rest of API
- **Area:** API Contract / Error Shape
- **Detail:** 12 squawks 500-handlers return bare `{error}` while other route files return `{error, reference_id, retry_safe}`; clients can't unify error handling.
- **Files:** `src/server/routes/routes-squawks.ts:596`
- **Recommendation:** Migrate squawks handlers to formatErrorForUser() and the standard three-field envelope.

### TD-112 — frc-super-admin results list returns a raw array; detail returns {result}
- **Area:** API Contract / Response Shape
- **Detail:** GET /frc-super-admin/results returns a bare array while the detail endpoint wraps in `{result}`, breaking the resource-envelope convention.
- **Files:** `src/server/routes/routes-frc-super-admin-results.ts:84`
- **Recommendation:** Return `{ results: rows }` to match the convention and the detail shape.

### TD-113 — GET /discrepancy-log/:equipmentId unbounded SELECT (+ unbounded user lookup)
- **Area:** Pagination / Unbounded Queries
- **Detail:** Fetches every hobbs/tach discrepancy event for an aircraft with no LIMIT, then an unbounded inArray user lookup.
- **Files:** `src/server/routes/routes-discrepancy-log.ts:69`
- **Recommendation:** Add .limit(500) + optional ?from/?to range, or cursor pagination returning { discrepancies, hasMore }.

### TD-114 — Numerous schema FK / unique-constraint / type omissions (consolidated)
- **Area:** Schema integrity
- **Detail:** Missing FK references: users/equipment/logbookEntries/stageCheckResults.ingestBatchId; classes.courseId; studentCustomFieldValues.studentId; workflowSchedules.flightSchoolId+locationId; audit_log.flightSchoolId+locationId; checkrideFieldEvents.checkrideId+fieldDefinitionId; checkrideLeadBonus.flightSchoolId; packetTemplateSections/Items/Versions.flightSchoolId; checkrideTaskSections.flightSchoolId; workOrders.voidedByUserId/completedByUserId/signoffUserId; announcementAcknowledgements/announcementRecipients.userId; smsConsent.userId; aiCostLedger.executionTraceId; frcTestRuns.requestedBy; irisAssessments.recalculatedFrom; partsInventoryTransactions.workOrderId; fuelInvoices.flightSchoolId. Missing/weak unique constraints: courseStandaloneInstructors/Students "unique" plain index; customerStudentLinks plain index; aiModelCatalog(providerKey,modelKey) plain index; flightSchools email/phone no unique index. Type mismatches: studentAgreements.studentId is text not uuid; accountingProviderConnections.status/environment varchar not enum; qbSyncLog.attemptNumber/durationMs varchar not integer. Other: flightSchools deprecated Stripe columns not dropped.
- **Files:** `src/lib/schema/index.ts` (multiple), `src/lib/schema/quickbooks.ts`, `src/lib/schema/accounting.ts`, `src/lib/schema/frc-super-admin.ts`, `src/lib/schema/ai-control-center.ts`
- **Recommendation:** Add the missing `.references()` (cascade/set-null per relationship), promote "unique" plain indexes to uniqueIndex(), migrate studentAgreements.studentId to uuid+FK, promote status/environment to pgEnum and qbSyncLog numerics to integer, and schedule a migration to drop deprecated Stripe columns.

### TD-115 — JSON-blob columns hiding relational data (conversations, schedule_events, support_tickets, curricula, trainingPrograms)
- **Area:** Schema / Data Modeling
- **Detail:** `conversations.participants/unreadCounts` duplicate conversation_participants and use non-atomic read-modify-write (lost-update race on unread counts); `schedule_events.instructorIds/studentIds` JSON arrays have no FK/index and student-centric queries miss group events; `support_tickets.conversationHistory`, `curricula.stages/versions/courseOrder`, and `trainingPrograms.courseOrder` duplicate relational tables and cause read amplification / drift.
- **Files:** `src/lib/schema/index.ts:3207-3211, 881-882, 1224, 533-548, 3754-3766`
- **Recommendation:** Migrate participants/unread to conversation_participants (atomic counters), event participants to an event_participants junction, ticket history to support_ticket_messages, and read stages/courseOrder from the normalized tables; deprecate the blobs.

## LOW (deep scan)

### TD-116 — Misc low-severity items (consolidated)
- **Area:** Multiple
- **Detail:** (a) Aircraft Logbook PDF export route returns a 501 stub — `routes-aircraft-logbook.ts:876`. (b) POA service calls non-existent /poa-modules/* endpoints (dead code) — `services/poa.ts:75`. (c) createStripeInvoiceForBillingRow runs the idempotency check after customer creation — `hilo-stripe-billing-service.ts:247-252`. (d) Curriculum stageId inconsistent (UUID vs name) for unplaced students — `routes-ai-schedule.ts:1799/1833`. (e) ai-chat-widget dangerouslySetInnerHTML without escaping (needs prompt injection) — `ai-chat-widget.tsx:155` (shared fix with TD-54). (f) proxy-image endpoint has no auth (allowlisted, size-capped) — `proxy-image/route.ts:65` (also see TD-48). (g) orphan-detection-cron one sequential query per FK, no statement timeout — `orphan-detection-cron/route.ts:110-130`. (h) Unbounded SELECTs: GET /squawks (`routes-squawks.ts:578`), GET /locations/:id/workflows (`routes-workflows.ts:707`), GET /calibration/equipment/:id three sub-fetches (`routes-calibration-log.ts:331`), findByStudent assignment completions (`routes-assignments.ts:105`). (i) routes-workflows POST raw body with unchecked `as string` casts (`routes-workflows.ts:93`; cross-ref TD-16). (j) aiCostLedger.executionTraceId / frcTestRuns.requestedBy / irisAssessments.recalculatedFrom / packetTemplate child flightSchoolId / smsConsent.userId / workOrders user FKs missing references (rolled into TD-114).
- **Files:** see Detail
- **Recommendation:** Implement the logbook PDF route or handle 501 gracefully; delete/rewrite the POA service; reorder the idempotency check; give curriculum stages explicit ids; apply escapeHtml (TD-54); add auth to proxy-image (TD-48); add statement timeouts / parallelism to orphan-detection; add default LIMITs + cursor params to the unbounded list endpoints; add Zod validation to workflow POST/PUT.

### TD-117 — E2E/BDD/unit test quality: shallow, tautological, skipped, soft-pass tests (consolidated)
- **Area:** Test Suite Integrity
- **Detail:** deletion-guardrails.spec.ts — all 5 tests are `expect(true).toBe(true)` no-ops. RBAC/auth-redirect tests (role-permissions.spec.ts:72/511, airlines-flow.spec.ts:127) assert only `not.toHaveURL(/500/)` — pass on a broken guard. schedule-ai-sandbox.spec.ts:254 `expect(hasGenerate||true)` tautology (plus H-09..H-11 `expect(true)`); drag tests H-03..H-06 assert only that "AI Sandbox" text is visible. `expect(true).toBe(true)` soft-passes in student-crud.spec.ts (5), schedule-flow.spec.ts (8, incl. Log Lesson regression), equipment-crud.spec.ts (3), aircraft-utilization-regression.spec.ts:93. instructor-roster-regression.spec.ts never verifies the Inactive filter actually filters. navigation/canary/auth.spec.ts assert only container/`body` visibility (no content). my-programs-completion-regression.spec.ts entire block skipped; workflow-engine.test.ts G-06 skipped (Asana 1214149035279126) and the publish path no longer fires executeScheduleTrigger. billing.steps.ts (BDD) soft-passes sign-off and billing-row assertions via console.warn. jest.config.ts global thresholds 15%/8% (see TD-06). No E2E asserts cross-tenant data isolation (School A → School B).
- **Files:** `e2e/*.spec.ts`, `e2e-bdd/step-definitions/billing.steps.ts`, `src/__tests__/schedule/workflow-engine.test.ts`, `jest.config.ts`
- **Recommendation:** Replace tautologies/soft-passes with real assertions or `test.skip(reason)`; make RBAC tests assert redirect-to-signin or access-denied; add functional content assertions; add a cross-tenant isolation E2E; re-enable/rewrite the skipped specs (resolve Asana 1214149035279126); ratchet coverage with per-path floors on billing/auth/server routes.

---

## Strengths Observed (not debt — context for triage)

- Better Auth properly configured; role re-fetched from DB each request (catches mid-session promotions).
- Stripe webhook signature verification correct (raw body, fail-closed).
- Comprehensive test infra (Jest unit/integration, Playwright, Cucumber BDD, Stryker mutation, Checkly synthetics) with role-based E2E projects.
- Strong CI: format/lint/typecheck/test gates, invariant checks, migration parity, anti-pattern health checks, PDD guard, billing guard.
- Sophisticated ops: Neon branch-per-PR, credential self-healing, blue-green deploy, auto-rollback, P0 auth monitoring.
