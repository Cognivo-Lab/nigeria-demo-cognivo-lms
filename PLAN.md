# Cognivo LMS — Build Plan (file-level)

**Product:** Cognivo LMS (operator-named). White-label platform; first instance
`nigeria-demo`; default brand when unset: **Nigeria Demo**.
**Stage:** plan. **Author:** eng specialist (technical feasibility & sequencing).
**Date:** 2026-11-12.
**Source of truth for scope:** PRD.md §6 and INTERVIEW.md. Strategy: STRATEGY.md.
Architecture decisions: ARCHITECTURE.md (read alongside this).

This document names every file the build creates and what it is responsible for,
the order the work happens in, and how each phase is verified against its goal. It
does not re-argue scope (PRD.md) or positioning (STRATEGY.md).

---

## 0. What the build must deliver (restated as checkable outcomes)

From PRD.md §6, confirmed in INTERVIEW.md:

1. **No-login persona switch** — a prospect enters any of four personas in one
   click; every screen is populated (no empty demo states).
2. **Four dashboards** — potential learner (browse), registered learner, provider,
   owner.
3. **Four flows end-to-end against Postgres** — (a) quiz → certification test →
   certificate; (b) completion-gated feedback with provider replies visible to
   all, shown as a thread; (c) AI-built learning roadmap; (d) wishlist + calendar.
4. **Catalogue** — 30+ courses, several domains, mixed formats (video, downloadable
   reading, quizzes), searchable, with personalised recommendations.
5. **Rich dummy history** — completions + test results spread over time so every
   chart and report reads like a real operating platform.
6. **Cross-cutting** — Postgres; WCAG 2.1 AA; responsive to 375px; security;
   information governance; exportable dashboards; white-label branding; yellow
   clam-shell icon bottom-right on the homepage.
7. **Forge mandates** — real auth + SSO + RBAC + tenant isolation (production
   profile); demo/production profiles; migrations on boot; health/readiness; config
   from env validated at boot; runs behind a TLS proxy; marketing website at `/`,
   app behind sign-in at `/app`; audit log; data export/erasure; backup/restore.

See ARCHITECTURE.md for *why* the demo's "no login" and the mandate's "real auth"
both hold at once (short version: the persona buttons establish **real sessions**
for **real seeded accounts** via a demo-only endpoint; RBAC and tenant scoping are
enforced on the server in every profile).

---

## 1. Stack (chosen in the eng lane; rationale in ARCHITECTURE.md §2)

- **Runtime:** Node.js 20 LTS, TypeScript 5 (strict).
- **API:** Express 4 + `pg` (node-postgres) with an explicit repository layer.
  No ORM — the data access is tenant-scoped by hand so isolation is auditable.
- **Validation:** Zod at every request boundary and at env boot.
- **Auth:** DB-backed sessions (signed HttpOnly cookie → `sessions` row); `argon2`
  password hashing; `openid-client` for OIDC SSO (PKCE + state + nonce, JWKS
  signature + iss/aud/exp validation); `express-rate-limit` on auth routes.
- **Front end:** React 18 + TypeScript + Vite; React Router; TanStack Query for
  data; Recharts for charts (built per the `dataviz` skill at build time). Theming
  via CSS custom properties with Light/Dark/System.
- **AI roadmap:** behind a `RoadmapGenerator` interface. Default is a deterministic
  rule-based generator (no network — fits the Nigeria connectivity constraint,
  STRATEGY.md §3C). Optional LLM generator (Anthropic Claude, `claude-sonnet-5-5`)
  enabled only when `AI_API_KEY` is set; built per the `claude-api` skill.
- **Migrations:** plain, numbered SQL files applied by a small runner, tracked in
  `schema_migrations`. Explicit over clever; committed to the repo.
- **Logging:** `pino` structured logs with a per-request id; never logs secrets/PII.
- **Security headers:** `helmet` + a strict CSP.
- **Tests:** Vitest (unit + API integration via Supertest) and Playwright (E2E),
  run against a disposable Postgres. One command: `npm test`.
- **Container:** Dockerfile (multi-stage) + docker-compose (app + postgres) with a
  HEALTHCHECK wired to `/health`.

---

## 2. Data model (tables; full DDL lives in migrations, §5)

Tenancy spine: **`organisations`** (the white-label instance). Every
tenant-owned row carries `org_id`; every read and write is filtered by the
caller's `org_id` on the server.

- `organisations` — id, slug (`nigeria-demo`), brand_name, created_at.
- `users` — id, org_id, email (unique per org), password_hash (nullable for
  SSO-only), display_name, role (`owner|provider|learner`), sso_subject,
  created_at, deleted_at.
- `sessions` — id, user_id, csrf_secret, created_at, expires_at, last_seen.
- `auth_providers` — per-org OIDC config presets (optional; env-driven fallback).
- `domains` — id, org_id, name, slug, description, icon. (Learning categories.)
- `providers` — id, org_id, user_id, name, bio, logo_url. (Course-provider profile.)
- `courses` — id, org_id, provider_id, domain_id, slug, title, summary, description,
  format (`video|reading|quiz|mixed`), level, est_minutes, hero_url, published,
  rating_avg (denormalised), rating_count, created_at.
- `lessons` — id, course_id, order_index, type (`video|reading|quiz`), title,
  body_md, video_url, caption_vtt_url, est_minutes.
- `lesson_assets` — id, lesson_id, label, file_path, mime, bytes. (Downloadable
  reading.)
- `quizzes` — id, course_id, lesson_id (nullable), title, pass_pct.
- `quiz_questions` — id, quiz_id, order_index, prompt, explanation.
- `quiz_options` — id, question_id, label, is_correct.
- `certification_tests` — id, course_id, title, pass_pct, time_limit_min, question
  bank linkage (reuses quiz_questions tagged `test`).
- `enrollments` — id, org_id, user_id, course_id, status
  (`in_progress|completed`), progress_pct, started_at, completed_at.
- `lesson_progress` — id, enrollment_id, lesson_id, completed_at.
- `wishlist` — id, org_id, user_id, course_id, added_at. (Separate from enrollment
  so provider "wishlist count" is clean.)
- `quiz_attempts` — id, org_id, user_id, quiz_id, score_pct, passed, answers_jsonb,
  attempted_at.
- `test_attempts` — id, org_id, user_id, test_id, course_id, status
  (`scheduled|in_progress|passed|failed`), scheduled_at, attempted_at, score_pct.
- `certificates` — id, org_id, user_id, course_id, serial (unique), verify_code,
  issued_at.
- `feedback` — id, org_id, course_id, learner_id, rating (1–5), comment, created_at.
  (Insert guarded: learner must have a `completed` enrollment for the course.)
- `feedback_replies` — id, org_id, feedback_id, provider_id, comment, created_at.
- `roadmaps` — id, org_id, user_id, rationale, generator (`rules|llm`), created_at.
- `roadmap_items` — id, roadmap_id, course_id, order_index, reason.
- `audit_log` — id, org_id, actor_id, action, entity, entity_id, metadata_jsonb,
  created_at. (Append-only; no update/delete grant in app role.)
- `consents` — id, user_id, kind (`cookies|terms|privacy`), granted_at.
- `schema_migrations` — version, applied_at.

Derived, not stored: calendar events (from enrollment starts/completions +
scheduled test_attempts); recommendations (content + popularity); all owner/provider
metrics (aggregates over the above).

---

## 3. API surface (every protected route checks session → role → org)

Auth: `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me`,
`POST /api/auth/password/forgot`, `/password/reset`,
`GET /api/auth/sso/:provider`, `/callback/:provider`.
Demo-only (404 in production): `GET /api/auth/demo/personas`,
`POST /api/auth/demo/switch`.

Catalogue (public): `GET /api/brand`, `/api/catalog/domains`,
`/api/catalog/courses` (q, domain, format, level, sort, page),
`/api/catalog/courses/:slug`, `/api/catalog/recommendations`,
`GET /api/courses/:slug/feedback` (public threads + aggregate).

Learner (auth, role=learner): `POST /api/enrollments`,
`GET /api/enrollments`, `POST /api/enrollments/:id/lessons/:lessonId/complete`,
`GET /api/courses/:slug/player`, `POST /api/quizzes/:quizId/attempts`,
wishlist `GET/POST /api/wishlist` + `DELETE /api/wishlist/:courseId`,
`GET /api/calendar`, roadmap `GET /api/roadmap` + `POST /api/roadmap/generate`,
tests `POST /api/courses/:courseId/test/schedule`, `GET /api/tests/scheduled`,
`POST /api/tests/:testId/attempts`, certificates `GET /api/certificates`,
`POST /api/courses/:courseId/feedback` (completion-gated).

Public verify: `GET /api/certificates/:serial`.

Provider (auth, role=provider): `GET /api/provider/overview`,
`/api/provider/courses`, `/api/provider/courses/:id/analytics`,
`/api/provider/feedback`, `POST /api/feedback/:feedbackId/replies`.

Owner (auth, role=owner): `GET /api/owner/overview`,
`/api/owner/metrics/timeseries`, `GET /api/admin/audit`.

Exports (RBAC per dashboard): `GET /api/exports/:dashboard.csv`
(`learner|provider|owner`); PDF via print route `/app/print/:dashboard`.

Governance (self-serve): `GET /api/account/export`, `POST /api/account/delete`.
Setup (production profile): `GET /api/setup/status`, `POST /api/setup`.
Ops: `GET /health` (checks DB), `GET /healthz` (liveness).

---

## 4. Repository layout (file → responsibility)

```
/ (product root)
  package.json              workspaces: server, web; scripts: dev, build, start, migrate, seed, test, lint
  tsconfig.base.json        strict TS config shared by both workspaces
  .env.example              every env var documented (see §6)
  forge.dependencies.json   declared external services (written this stage)
  forge.acceptance.json     HTTP-probe acceptance criteria (written this stage)
  SCOPE.json                feature registry + definition-of-done (written this stage)
  docker-compose.yml        app + postgres; HEALTHCHECK → /health
  Dockerfile                multi-stage: build web + server, run server serving web/dist
  README.md                 run from zero: local http + behind proxy; profiles; one-command test
  OPERATIONS.md             install / uninstall / backup / restore / env / health / incident notes
  LICENSE
```

### server/ (API + persistence + ops)
```
server/package.json
server/tsconfig.json
server/src/index.ts                 boot: load+validate env → retry DB w/ backoff → run migrations → mount app → listen → graceful shutdown (SIGTERM)
server/src/app.ts                   Express app: helmet/CSP, requestId, pino-http, body limits, routers, error handler, static web/dist for /app and /
server/src/config/env.ts            Zod schema for env; fails loud naming the exact missing var; derives profile
server/src/config/brand.ts          brand resolution (org.brand_name → env BRAND_NAME → "Nigeria Demo"); exposes /api/brand payload
server/src/db/pool.ts               pg Pool; connect-with-backoff helper
server/src/db/migrate.ts            numbered SQL runner; records schema_migrations; idempotent
server/src/db/migrations/0001_core.sql            organisations, users, sessions, auth_providers, consents, audit_log
server/src/db/migrations/0002_catalog.sql         domains, providers, courses, lessons, lesson_assets
server/src/db/migrations/0003_assessment.sql      quizzes, quiz_questions, quiz_options, certification_tests
server/src/db/migrations/0004_learning.sql        enrollments, lesson_progress, wishlist, quiz_attempts, test_attempts, certificates
server/src/db/migrations/0005_feedback_roadmap.sql feedback, feedback_replies, roadmaps, roadmap_items
server/src/db/migrations/0006_indexes.sql         search indexes (trigram on title/summary), FKs, constraints, uniques
server/src/db/repositories/*.ts     one module per aggregate (users, courses, enrollments, quizzes, tests, certificates, feedback, wishlist, roadmap, metrics, audit); EVERY query takes orgId and filters by it
server/src/middleware/requestId.ts  attaches/propagates x-request-id
server/src/middleware/session.ts    reads cookie → loads session+user → req.user
server/src/middleware/rbac.ts       requireRole(...roles); 403 on mismatch; used on every protected route
server/src/middleware/tenant.ts     pins req.orgId; guarantees downstream repos receive it
server/src/middleware/rateLimit.ts  auth-route limiter
server/src/middleware/errors.ts     central handler: safe client messages, no internal leakage, logs with request id
server/src/middleware/csrf.ts       double-submit CSRF for cookie-auth mutations
server/src/auth/password.ts         argon2 hash/verify; reset-token issue/verify
server/src/auth/session.ts          create/destroy session; cookie flags: HttpOnly, SameSite=Lax, Secure from x-forwarded-proto
server/src/auth/sso.ts              openid-client flows; provider presets (Google/Entra/Okta); find-or-create by verified email
server/src/auth/demo.ts             demo persona list + switch (guarded by APP_PROFILE=demo)
server/src/routes/auth.ts
server/src/routes/catalog.ts
server/src/routes/learning.ts       enrollments, player, lesson complete, quizzes
server/src/routes/wishlist.ts
server/src/routes/calendar.ts
server/src/routes/roadmap.ts
server/src/routes/tests.ts          schedule, attempt, certificate issue on pass
server/src/routes/certificates.ts   list mine + public verify
server/src/routes/feedback.ts       list(public), create(gated), reply(provider)
server/src/routes/provider.ts
server/src/routes/owner.ts
server/src/routes/exports.ts        CSV builders per dashboard (RBAC-checked)
server/src/routes/account.ts        GDPR export + erasure
server/src/routes/setup.ts          first-run owner/org creation (production)
server/src/routes/health.ts         /health (DB check) + /healthz
server/src/services/metrics.ts      owner + provider aggregate queries (attendance, completion, cert funnel, test success, time series)
server/src/services/recommend.ts    content+popularity recommender (deterministic)
server/src/services/roadmap/index.ts        RoadmapGenerator interface + selection by env
server/src/services/roadmap/rulesGenerator.ts   deterministic path builder (domain affinity, difficulty ramp, gaps)
server/src/services/roadmap/llmGenerator.ts     optional Anthropic-backed generator (AI_API_KEY)
server/src/services/exportCsv.ts    shared CSV serialisation (escaping, BOM)
server/src/services/audit.ts        append-only audit writer used by every mutation
server/src/seed/seed.ts             entry: seeds org, brand, personas, domains, providers, courses, lessons, quizzes, tests
server/src/seed/catalog.data.ts     30+ courses across ~6 domains, mixed formats (real titles/summaries, no lorem)
server/src/seed/history.generator.ts rich historic completions + quiz/test results spread across ~18 months for charts
server/src/seed/personas.ts         seeded owner, 3 providers, ~40 learners incl. the clickable demo personas
server/tests/unit/*.test.ts         domain logic: completion gating, cert issue rules, recommender, roadmap, metrics math
server/tests/api/*.test.ts          integration incl. AUTHORIZATION DENIALS (cross-tenant 404, wrong-role 403, ungated feedback 403, unauth 401)
server/tests/helpers/db.ts          spin up schema + seed into a disposable test DB
```

### web/ (marketing site + four dashboards)
```
web/package.json
web/tsconfig.json
web/vite.config.ts
web/index.html                      includes the yellow clam-shell icon mount; app root
web/src/main.tsx                    router bootstrap
web/src/App.tsx                     route table: public "/" marketing, "/app/*" behind session
web/src/api/client.ts               fetch wrapper (credentials, CSRF header, error normalisation)
web/src/api/queries.ts              TanStack Query hooks per resource
web/src/theme/tokens.css            CSS custom properties: colour, type, spacing (light + dark, AA-verified)
web/src/theme/ThemeProvider.tsx     Light/Dark/System; persists; drives prefers-color-scheme
web/src/theme/useTheme.ts
web/src/components/                  design system: Button, Card, Input, Select, Modal, Tabs, Table(+scroll container tabindex=0), Badge, Chip, Toast, Skeleton, EmptyState, ErrorState, Rating, Avatar, ProgressBar, Pagination, FormField(inline validation)
web/src/components/Chart/*          Recharts wrappers (built per dataviz skill): LineTrend, BarCompare, Donut, Funnel, StatTile, Sparkline
web/src/components/AppShell.tsx     landmarks, nav, skip-link, brand header/footer, theme toggle, persona badge
web/src/components/ClamShell.tsx    yellow clam-shell icon, fixed bottom-right of the homepage
web/src/components/BrandProvider.tsx reads /api/brand → header, <title>, footer
web/src/components/ExportMenu.tsx   CSV download + "Print / PDF" per dashboard
web/src/pages/marketing/Home.tsx        hero + value prop + capabilities + screenshots + social proof + CTA + clam-shell
web/src/pages/marketing/Features.tsx
web/src/pages/marketing/Pricing.tsx     Starter/Pro/Enterprise, comparison matrix, trial CTA → real sign-up (display only)
web/src/pages/marketing/About.tsx
web/src/pages/marketing/Faq.tsx
web/src/pages/marketing/Legal.tsx       Terms + Privacy + cookie notice
web/src/pages/auth/SignIn.tsx           local login + "Sign in with <provider>" (shown only if SSO configured)
web/src/pages/auth/SignUp.tsx
web/src/pages/auth/ResetPassword.tsx
web/src/pages/PersonaSwitch.tsx         no-login demo entry: four buttons → real session (demo profile)
web/src/pages/catalog/Catalog.tsx       search, filters, domain nav, course cards, recommendations (potential learner)
web/src/pages/catalog/CourseDetail.tsx  syllabus, aggregate rating + feedback threads, enrol/wishlist
web/src/pages/learn/CoursePlayer.tsx    video(captions)/reading(download)/quiz lessons, progress, mark complete
web/src/pages/learn/Quiz.tsx            take quiz → score
web/src/pages/learn/TestRoom.tsx        certification test → pass issues certificate
web/src/pages/learner/Dashboard.tsx     completed, certificates, scheduled exams, wishlist, continue-learning, roadmap panel
web/src/pages/learner/Calendar.tsx      month view across started + completed + scheduled exams
web/src/pages/learner/Roadmap.tsx       AI roadmap view + regenerate
web/src/pages/learner/Certificates.tsx  list + shareable verify link
web/src/pages/learner/FeedbackForm.tsx  completion-gated; blocked UI if not completed
web/src/pages/provider/Dashboard.tsx    wishlist counts, active progress, completions, certification funnel per course
web/src/pages/provider/FeedbackThreads.tsx  reply to learner feedback (thread, visible to all)
web/src/pages/owner/Dashboard.tsx       quality, feedback, attendance/completion, testing in-progress + success rates, time series
web/src/pages/owner/Audit.tsx           audit log viewer
web/src/pages/print/PrintDashboard.tsx  print-optimised render for PDF export
web/src/pages/Setup.tsx                 first-run owner creation (production profile)
web/src/lib/a11y.ts                     focus trap, announce, keyboard helpers
web/src/lib/format.ts
web/e2e/*.spec.ts                       Playwright journeys: persona switch; quiz→test→certificate; gated feedback + reply; roadmap generate; wishlist+calendar; export; theme toggle; 375px no-overflow
```

---

## 5. Build sequence (phases; each is independently verifiable and sized to a clean context)

**Phase 1 — Skeleton & operability.** env.ts, pool.ts, migrate.ts + `0001`,
app.ts, health.ts, index.ts (backoff + graceful shutdown), Dockerfile,
docker-compose, README/OPERATIONS skeleton.
*Verify:* `docker compose up` on a cold DB → app waits, migrates, `/health` 200
checks DB; missing env fails loud naming the var.

**Phase 2 — Identity & tenancy.** sessions, password, sso, demo; session/rbac/
tenant/csrf/rateLimit middleware; routes/auth; setup route; account (export/erase).
*Verify:* register/login/logout/me; SSO code-flow against a test OIDC; cross-tenant
request → 404; wrong role → 403; Secure cookie only under https (x-forwarded-proto).

**Phase 3 — Catalogue & content.** migrations `0002`–`0003`; catalog repo/routes;
player route; seed catalog (30+ courses) + personas.
*Verify:* search/filter return seeded courses; course detail renders syllabus;
recommendations non-empty; public catalogue reachable without a session.

**Phase 4 — Learning flows.** migrations `0004`–`0005`; enrollments, quizzes,
tests, certificates, wishlist, calendar, roadmap, feedback routes + services.
*Verify (the four flows):* quiz→test→certificate issues a real certificate row;
feedback blocked (403) until a completed enrollment exists, then thread + provider
reply visible publicly; roadmap generate returns ordered items; wishlist add →
appears in calendar.

**Phase 5 — History & dashboards.** history.generator (18 months of completions +
results); metrics service; provider + owner routes; CSV exports; print route.
*Verify:* owner/provider dashboards populated from seeded history; every chart has
data; CSV downloads parse; export RBAC denies the wrong role.

**Phase 6 — Front end & a11y polish.** theme tokens (AA in both themes), AppShell
landmarks, all pages, clam-shell, ExportMenu, loading/empty/error states, inline
validation; Playwright journeys incl. 375px overflow + keyboard.
*Verify:* full E2E green; 375×667 no horizontal overflow; AA contrast light+dark;
keyboard-only completes each journey; `npm test` green in one command.

Dependency order is strict: 1→2→3→4→5→6. Phases 3 and 4 share the seed; 5 depends on
4's tables; 6 depends on all APIs existing.

---

## 6. Environment variables (documented in .env.example; validated at boot)

Required: `DATABASE_URL`, `SESSION_SECRET` (generated at install if unset),
`APP_PROFILE` (`demo|production`, default `production`), `PORT`, `PUBLIC_BASE_URL`.
Install-set: `SEED_PASSWORD` (demo/first-run account password; forge sets per
install; random + logged once if unset), `BRAND_NAME` (default "Nigeria Demo"),
`DATA_RESIDENCY` (informational banner/governance).
Optional (features degrade cleanly if unset): `OIDC_ISSUER`, `OIDC_CLIENT_ID`,
`OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI` (SSO button hidden if absent);
`SMTP_URL`, `SMTP_FROM` (password-reset emails; falls back to logged reset link in
demo); `AI_API_KEY`, `AI_MODEL` (LLM roadmap; falls back to rules generator).

---

## 7. Cross-cutting requirements → where they are satisfied

- **375px + WCAG AA:** built into `theme/tokens.css`, every component, and the
  design stage's wireframe; proven by Playwright (overflow + axe) and the Forge
  responsive/contrast gate measuring the source. Every UI feature's definition of
  done in SCOPE.json carries "fits 375px" and "meets AA in every theme shipped".
- **Security:** parameterised queries everywhere; Zod-bounded inputs; argon2;
  HttpOnly+SameSite cookies, Secure from x-forwarded-proto; helmet + CSP;
  auth rate-limited; no secrets/PII in logs or URLs; RBAC + tenant isolation on the
  server for every protected route and record.
- **Information governance:** immutable `audit_log` on every mutation (owner-view at
  `/app/owner/audit`); self-serve data export + erasure; consent capture; Privacy +
  Terms pages; `DATA_RESIDENCY` recorded and surfaced (ARCHITECTURE.md §6).
- **Exportable dashboards:** CSV endpoints + print route, learner/provider/owner.
- **White-label:** `/api/brand` → header, `<title>`, footer; default "Nigeria Demo".
- **Operability:** migrations on boot, DB retry/backoff, `/health`, graceful
  shutdown, demo/production profiles, install/uninstall/backup/restore in
  OPERATIONS.md.

---

## 8. Deferred (named here so it is never silently dropped — PRD.md §6)

Group/cohort assignment with deadlines; anti-cheating integrity (identity
verification, lockdown browser, AI proctoring/viva); freemium audit-vs-paid access;
enterprise seat-based / skill-gap / role-play extensions; learner editing of
submitted feedback; specialisations / professional certificates / degrees as
distinct product *tiers* (the catalogue carries the formats; the tiers are not
built). The schema leaves room (e.g. a nullable `cohort_id` is **not** added now,
but `enrollments`/`courses` are shaped so adding it later is additive, not a
rewrite).
