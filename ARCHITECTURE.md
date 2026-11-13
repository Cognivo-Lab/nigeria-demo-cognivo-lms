# Cognivo LMS — Architecture Decisions

**Stage:** plan. **Author:** eng specialist. **Date:** 2026-11-12.
Companion to PLAN.md (file-level build plan) and STRATEGY.md (positioning).
This records the load-bearing engineering decisions and the Forge-mandate choices
that must be stated explicitly.

---

## 1. Shape

A single deployable app per white-label instance: an Express/TypeScript API over
Postgres, serving a React/Vite front end (marketing site at `/`, app behind
sign-in at `/app`). One codebase is both the demo and the product (STRATEGY.md §4):
instance N+1 is configuration, not a rebuild.

## 2. Why this stack

- **Postgres** is mandated (INTERVIEW.md) and fits relational, reporting-heavy data
  (funnels, time series, aggregates).
- **No ORM, explicit repository layer.** Tenant isolation is the top security risk;
  hand-written, `org_id`-filtered queries are auditable in a way ORM magic is not.
  Parameterised throughout.
- **React SPA + JSON API** keeps the four dashboards and chart-heavy exports simple
  and keeps pages light (Nigeria connectivity constraint, STRATEGY.md §3C). SSR was
  rejected as unneeded complexity for a logged-in app; the marketing routes are
  static-cheap.
- **Recharts** over D3-from-scratch: faster, accessible defaults, built per the
  `dataviz` skill.

## 3. The demo "no login" vs the mandate's "real auth" — reconciled

The brief requires persona selection by button with no login. The Forge Identity &
Access mandate requires real auth, SSO, RBAC, and tenant isolation because the
product is multi-user and stores per-user data. Both hold:

- Auth, sessions, RBAC, and tenant scoping are **real and enforced on the server in
  every profile.** The client never decides authorisation.
- In **`APP_PROFILE=demo`**, the landing page shows four persona buttons. Each calls
  a demo-only endpoint (`POST /api/auth/demo/switch`) that establishes a **real
  session for a real seeded account** of that persona. No credentials are typed, but
  the session, RBAC, and `org_id` scoping that follow are identical to production.
- The seeded demo accounts also have passwords (= `SEED_PASSWORD`), so the normal
  `POST /api/auth/login` works for them too — which is what forge.acceptance.json
  uses to prove a real session.
- In **`APP_PROFILE=production`**, the demo switch endpoint returns 404, the app
  starts empty, and first-run setup creates the owner. Local login + SSO are the
  only ways in.

This is the whole reason the demo can be frictionless without weakening the security
posture a buyer's deployment needs.

## 4. Roles & tenancy

Roles: `owner` (platform owner — full oversight, audit, all dashboards),
`provider` (manages own courses, replies to feedback on them), `learner` (member).
The **potential learner is anonymous** — public catalogue routes need no session.
`requireRole(...)` guards every protected route; `403` on mismatch.

Tenancy: `organisations` is the instance. Every tenant-owned row carries `org_id`;
every repository method takes `orgId` and filters by it; cross-tenant reads/writes
are impossible and are proven by integration tests that seed a second org and assert
`404`. The demo seeds one org (`nigeria-demo`); isolation is enforced regardless.

## 5. Sessions, cookies, proxy

DB-backed sessions (`sessions` table) keyed by a signed HttpOnly cookie,
`SameSite=Lax`. **`Secure` is derived from the actual request scheme via
`x-forwarded-proto`, never from `NODE_ENV`** — so local http sign-in is not silently
broken while https stays Secure. `app.set('trust proxy', ...)` honours
`x-forwarded-proto`/`-host`. Cookie-auth mutations carry a double-submit CSRF token.

## 6. Information governance, privacy, residency (personal data is stored)

- **Audit log:** append-only `audit_log` written by every mutation (`services/
  audit.ts`); owner-viewable at `/app/owner/audit`. The app DB role has no
  update/delete on it.
- **Data rights:** self-serve export (`GET /api/account/export`) and erasure
  (`POST /api/account/delete`, soft-delete + PII scrub + audit entry) — GDPR.
- **Consent:** cookie/privacy/terms consent captured in `consents`; a cookie notice
  renders until acknowledged; Privacy Policy + Terms pages ship.
- **Residency:** stated via `DATA_RESIDENCY` (surfaced in the owner/governance area
  and README). Default posture: single-region Postgres; encrypt in transit (TLS at
  the proxy); sensitive columns (password_hash) are hashed, not encrypted-reversible.
  A deployment that must pin a region sets `DATABASE_URL` to that region — recorded
  per instance.
- **Logs never contain** secrets or PII; request ids correlate instead.

## 7. AI roadmap

`RoadmapGenerator` interface with two implementations. **Default: deterministic
rules** (domain affinity from wishlist/history, difficulty ramp, coverage gaps) —
no network, works offline, cannot leak PII to a third party, and is the honest
default given the evidence does not support outcome claims (PRD.md §4, STRATEGY.md
§5). **Optional: Anthropic Claude** (`claude-sonnet-5-5`) when `AI_API_KEY` is set,
built per the `claude-api` skill; it receives only course metadata and coarse
progress, never raw PII. Selection is an env switch; the UI labels the roadmap as a
suggested path, not a proven outcome-lifter.

## 8. Persistence, migrations, backup

Numbered SQL migrations applied on boot (`src/db/migrate.js`, migrations in
`src/db/migrations/`), tracked in `schema_migrations`; committed to the repo.
Cold-DB tolerant: `connectWithRetry` (exponential backoff) before migrating so
app/DB start order is irrelevant. Backup/restore is documented `pg_dump`/
`pg_restore` in OPERATIONS.md; demo data is re-seedable with `npm run seed`.

**Implementation note (as built).** Persistence is Postgres via `pg`, selected by
`DATABASE_URL`. When `DATABASE_URL` is **unset**, the app falls back to an
in-process, Postgres-compatible engine (`pg-mem`) that runs the *same* SQL,
*same* migrations and *same* repository code — this is what lets the full test
suite and a "demo anywhere" container run with zero external services. It is
**not** persistent across restarts and is never used when `DATABASE_URL` is set
(production and any real deployment always provide it, giving durable Postgres).
All access goes through `src/repo.js` with parameterised queries; every tenant/
user query is id-scoped there. The route handlers load a per-request snapshot
(cheap at demo scale) and write through the repo's mutation methods.

## 9. Testing posture

Unit (domain rules: completion gating, certificate issuance, recommender, roadmap,
metrics math), API integration **including authorisation denials** (401 unauth, 403
wrong-role, 403 ungated feedback, 404 cross-tenant), and Playwright E2E for the four
journeys plus theme toggle and 375px overflow. Deterministic seed; one command
`npm test`; runnable in CI.

## 10. Explicitly rejected / deferred

Rejected now: ORM, microservices, SSR, a separate marketing CMS, per-feature
feature-flag service — all unjustified complexity for one deployable instance.
Deferred (PRD.md §6) but schema-compatible: cohorts/deadlines, proctoring,
freemium tiers, enterprise skill-gap/role-play, learner feedback editing. None are
built; none are designed out.
