# Cognivo LMS — Developer Experience & Maintainability Plan

**Product:** Cognivo LMS (operator-named). White-label; first instance `nigeria-demo`;
default brand when unset: **Nigeria Demo**.
**Stage:** plan. **Author:** dx specialist (developer experience & maintainability).
**Date:** 2026-11-12.
**Reads alongside:** PLAN.md (file tree + sequence), ARCHITECTURE.md (decisions),
DESIGN.md (design system), STRATEGY.md (positioning), SCOPE.json / forge.* (declarations).

This document is the **contract the build stage follows** so a new engineer can clone,
run, and change Cognivo in minutes, and so the codebase stays maintainable as instance
N+1 ships. It does not re-list files (PLAN.md §4) or re-argue decisions (ARCHITECTURE.md).
Two developer personas are served: the **operator** standing up a branded instance, and
the **contributor** extending the platform. Both must reach a working app fast and never
hit a dead end they cannot diagnose.

---

## 1. The one target that governs everything: Time To Hello World

**TTHW target: a running, seeded demo at `http://127.0.0.1:3000` in under 5 minutes,
in exactly two commands, on a machine with Docker.** The demo profile is the hello-world
path because it needs no OIDC, no SMTP, no AI key — just Docker.

```
git clone <repo> && cd cognivo
cp .env.example .env            # works as-is for the demo profile
docker compose up               # app waits for Postgres, migrates, seeds, serves
# open http://127.0.0.1:3000  → marketing home → "Enter the demo" → four persona buttons
```

Non-Docker (contributor) path, Node 20 + a local Postgres, still one visible sequence:

```
cp .env.example .env            # set DATABASE_URL to your local Postgres
npm install                     # root install hydrates both workspaces
npm run dev                     # migrate + seed (demo) + API + Vite, one command
```

**Rule for the build:** if getting to hello-world takes more than the lines above,
the gap is a DX defect, not operator error. No step may require hand-editing a file
other than `.env`, and `.env.example` must boot the demo unchanged.

---

## 2. The scripts contract — the single source of truth for every workflow

Every task a developer performs is one named `npm` script at the repo root, documented
in both `README.md` and `package.json`. The build MUST implement exactly these names
(PLAN.md §4 lists them; this fixes their behaviour so they never drift):

| Script | Does | Must be true |
|---|---|---|
| `npm install` | Installs root + `server` + `web` workspaces | One command hydrates everything; no per-workspace install needed |
| `npm run dev` | Boots API (watch) + Vite (watch); runs migrate then demo-seed first | Hot reload both sides; demo data present on first load |
| `npm run build` | Type-checks and builds `web/dist` + compiles `server` | Fails on any TS error (strict); no build warnings tolerated |
| `npm start` | Runs the compiled server serving `web/dist` | What the Docker image runs; production profile by default |
| `npm run migrate` | Applies pending SQL migrations, records `schema_migrations` | Idempotent; safe to run twice; prints each version applied |
| `npm run seed` | Seeds org/brand/personas/catalogue/history (demo) | Re-runnable; truncates+reseeds demo cleanly; refuses in production unless `--force` |
| `npm test` | Unit + API-integration + E2E against a disposable Postgres | Deterministic; one command; the CI entry point; exits non-zero on any failure |
| `npm run test:unit` / `test:api` / `test:e2e` | The three suites individually | For fast local loops; `npm test` runs all three |
| `npm run lint` | ESLint + Prettier check + `tsc --noEmit` on both workspaces | Zero warnings = green; the pre-PR gate |
| `npm run typecheck` | `tsc --noEmit` only, both workspaces | Fast feedback without lint |
| `npm run format` | Prettier write | The only formatter; no debate |

**Workspaces.** Root `package.json` declares npm workspaces `server` and `web` so one
install and root-level scripts fan out. A contributor never `cd`s into a workspace to
run a routine task. Keep the two `tsconfig.json` files extending `tsconfig.base.json`
(PLAN.md §4) so strict settings are defined once.

---

## 3. Boot-time config is self-explaining — the operator never guesses

Config comes only from the environment, validated at boot by `server/src/config/env.ts`
(Zod). The DX requirement on top of the Forge mandate: **every failure names the exact
variable, says why it is needed, and says what to do.** Problem → cause → fix, in one
message, written for someone who has never seen this codebase.

Good (build to this standard):

```
[config] FATAL: DATABASE_URL is required but not set.
  Why:  Cognivo stores all data in Postgres; it cannot start without a connection.
  Fix:  Set DATABASE_URL in .env, e.g.
        DATABASE_URL=postgres://cognivo:cognivo@localhost:5432/cognivo
  See:  .env.example and README.md §Getting started.
```

Bad (reject in review): `Error: invalid env` / a raw Zod stack trace / `undefined is not
a string`.

Rules:
- The validator collects **all** missing/invalid vars and prints them together, then
  exits non-zero — not one-at-a-time whack-a-mole.
- Optional vars that are unset print **one-line INFO** stating the degraded behaviour,
  so the operator sees the product is working as designed, not broken:
  `[config] INFO: OIDC_ISSUER unset → "Sign in with SSO" hidden; local login active.`
  Same pattern for `SMTP_URL` (reset link logged in demo) and `AI_API_KEY` (rules
  roadmap). These mirror `forge.dependencies.json` `withoutIt` text verbatim so the
  declared contract and the runtime message cannot disagree.
- `.env.example` documents **every** variable from PLAN.md §6 with a comment explaining
  what it is, whether it is required, and a safe default or example. It is the canonical
  reference; README links to it rather than restating it.
- `SESSION_SECRET` and `SEED_PASSWORD`: if unset, generate a strong random value at
  install, use it, and print it **once** to the log (never hard-code, never commit).
  Document this behaviour where it happens.

---

## 4. Runtime errors help the user and never leak internals

Two audiences, two standards, one rule (ARCHITECTURE.md §9, PLAN.md `middleware/errors.ts`):

- **API clients** get a stable JSON envelope: `{ "error": { "code": "...", "message":
  "...", "requestId": "..." } }`. `message` is safe and human; `code` is a stable slug a
  front-end can branch on (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `FEEDBACK_NOT_COMPLETED`, `VALIDATION`, `RATE_LIMITED`). No stack traces, SQL, or
  internal paths ever cross the wire.
- **Developers/operators** get the detail in the structured `pino` log, correlated by
  the same `requestId`. A support question becomes: "what's the request id?" → grep.
- The front-end `web/src/api/client.ts` normalises this envelope once, so every page's
  `ErrorState` (DESIGN.md) shows the safe message plus the request id for support, and
  never a raw fetch rejection.

**Validation errors** (Zod at the boundary) map to `422`/`400` with field-level messages
the front-end renders inline on the offending `FormField` (DESIGN.md inline-validation
contract) — not a toast, not a page error.

---

## 5. Maintainability conventions — so instance N+1 is config, not a rewrite

The business case (STRATEGY.md §4) depends on the second instance being cheap. That is a
code-discipline requirement, enforced in review:

- **Typed end to end.** TypeScript `strict` in both workspaces. No `any` that crosses a
  module boundary; no `@ts-ignore` without a one-line reason comment. API response types
  are defined once and shared in spirit between `server` routes and `web/src/api` hooks
  (shape parity checked by the API integration tests, which assert the envelope).
- **Module boundaries match PLAN.md's folders and do not leak.** Routes are thin: parse
  → authorise → call a repository/service → shape the response. **No SQL outside
  `db/repositories/*` and `services/metrics.ts`.** **Every repository method takes
  `orgId` as its first argument and filters by it** — this is both the security contract
  (ARCHITECTURE.md §4) and the maintainability contract: tenant scoping is visible at
  every call site, never implicit.
- **One way to do each cross-cutting thing.** One CSV serialiser (`services/exportCsv.ts`),
  one audit writer (`services/audit.ts` — called by every mutation), one fetch wrapper,
  one theme source (`theme/tokens.css` CSS custom properties — no hard-coded colours in
  components, so the white-label + Light/Dark contract holds). Duplicating any of these
  is a review-blocking DRY violation.
- **Naming is consistent and boring.** Files: `camelCase.ts` for modules, `PascalCase.tsx`
  for React components (matches PLAN.md §4). DB: `snake_case` tables/columns. API: plural
  nouns, kebab path segments. Roles are the three literals `owner|provider|learner`
  everywhere — no synonyms.
- **No dead code, no commented-out blocks, no TODO left as a feature.** A deferred item
  (SCOPE.json `deferred`) lives in the roadmap, not as a stubbed function. The schema is
  shaped so deferred items are additive (PLAN.md §8), but no half-built scaffolding ships.
- **Explicit over clever.** A 10-line obvious query beats a generic query builder. The
  rules-based roadmap/recommender stay readable procedures a new contributor follows in
  one sitting; the optional LLM path sits behind the same interface so the default is
  always the simple one.
- **Comments explain *why*, not *what*.** The non-obvious decisions (Secure-from-
  `x-forwarded-proto`, demo-switch establishing a real session, append-only audit) carry
  a short comment pointing at the ARCHITECTURE.md section, so the next reader finds the
  rationale.

---

## 6. Documentation the build must produce (and what each must contain)

PLAN.md §4 names `README.md` and `OPERATIONS.md`. This fixes their **table of contents**
so they are complete and consistent, and so the acceptance of "a new engineer can run from
them" is checkable:

**README.md** (the contributor + evaluator front door):
1. What Cognivo is — two sentences + the four personas, four flows (point to STRATEGY.md).
2. **Getting started** — the §1 two-command demo, then the Node/local-Postgres path.
3. **Profiles** — `APP_PROFILE=demo` vs `production`, what each does, how to switch.
4. **The scripts table** (§2) — every workflow, one line each.
5. **Configuration** — link to `.env.example`; call out required vs optional + degrade.
6. **Project layout** — the `server/` vs `web/` split in a short paragraph (link PLAN.md).
7. **Testing** — `npm test`, what the three suites cover, how to run one.
8. **Running behind a proxy / HTTPS** — the `trust proxy` + `PUBLIC_BASE_URL` note.
9. **Branding an instance** — set `BRAND_NAME`; where it appears (header/title/footer).
10. **Deploy** — Docker image + compose; health endpoint; where logs go.

**OPERATIONS.md** (the operator runbook):
1. Install (fresh) — compose up; first-run setup creates the owner (production).
2. Uninstall — compose down + volume removal; what data is destroyed.
3. Backup & restore — exact `pg_dump` / `pg_restore` commands; what to schedule.
4. Env reference — the governance-relevant vars (`DATA_RESIDENCY`, secrets rotation).
5. Health & monitoring — `/health` (DB-checking) vs `/healthz`; the container HEALTHCHECK.
6. Upgrades — pull, `npm run migrate` runs on boot; migrations are forward-only + additive.
7. Incident basics — reading `pino` logs by request id; rotating `SESSION_SECRET`.
8. Governance operations — viewing the audit log; running a data export/erasure request.

Both are **plain and copy-pasteable**: every command shown is one a reader can paste and
run. No "configure your environment appropriately" hand-waving.

Also ship `.env.example` (§3), `LICENSE`, and keep `forge.dependencies.json` as the
machine-readable mirror of README's dependency section.

---

## 7. Contributor workflow — low friction, consistent output

- **Pre-PR gate:** `npm run lint && npm test` must pass. Document this as the one thing to
  run before pushing. CI runs the identical commands so "green locally" means "green in CI."
- **Formatting is automated, not reviewed.** Prettier config committed; `npm run format`
  fixes everything; reviewers never comment on style.
- **CI:** a single workflow — install, lint, `npm test` against a disposable Postgres
  service — mirroring the local commands exactly. One command reproduces CI locally.
- **Commits/PRs:** conventional, scoped messages; a PR description states what changed and
  how it was verified. Keep PRs phase-sized (PLAN.md §5) so each is reviewable in one sitting.
- **Adding a feature** follows the grain: migration (numbered SQL) → repository (orgId-
  scoped) → route (thin, RBAC-guarded) → query hook → page/component (tokens + states) →
  tests incl. an **authorisation-denial** case → a line in the relevant doc. A new
  contributor can read this list and know where every piece goes.

---

## 8. DX scorecard — targets the build is measured against

| Dimension | Target | How it's proven |
|---|---|---|
| Time to hello world | < 5 min, 2 commands (Docker demo) | §1 sequence works on a clean machine |
| Getting-started friction | No file edits beyond `.env`; `.env.example` boots demo | Fresh clone → `docker compose up` → seeded app |
| Config errors actionable | Problem + cause + fix, names the var, collects all | `env.ts` messages; boot with a var missing |
| Runtime errors | Safe client message + request id; detail in logs only | `errors.ts` + `client.ts`; API tests assert envelope |
| Script discoverability | Every task is one named root script, in README | §2 table matches `package.json` |
| Naming/consistency | snake_case DB, PascalCase components, 3 role literals | lint + review |
| Docs run-from-zero | README + OPERATIONS let a new engineer install, run, back up | §6 contents present and paste-runnable |
| Escape hatches | Every opinionated default overridable by env; optional deps degrade | `.env.example` + `withoutIt` messages |
| Reproducible CI | `npm test` == CI; deterministic seed | one command, non-zero on failure |

**Escape hatches / overrides:** brand (`BRAND_NAME`), profile (`APP_PROFILE`), AI
generator (`AI_API_KEY`/`AI_MODEL`), SSO (`OIDC_*`), email (`SMTP_*`), residency
(`DATA_RESIDENCY`), port/base URL — all environment-driven, none requiring a code change.
The product never forces a default the operator cannot change without editing source.

---

## 9. Developer journey (what each stage must feel like)

1. **Discover** — README's first screen says what it is and shows the 2-command start.
2. **Install** — `docker compose up` (or `npm install`); no missing-tool surprises.
3. **First run** — app waits for a cold DB, migrates, seeds; opens to a populated demo.
4. **Explore** — four persona buttons; every screen tells a complete story (no empty states).
5. **Change** — `npm run dev` hot-reloads both sides; the add-a-feature grain (§7) is obvious.
6. **Validate** — `npm run lint && npm test`; fast suites for the inner loop.
7. **Diagnose** — an error names the var or carries a request id that hits the logs.
8. **Operate** — OPERATIONS.md runbook for backup, restore, health, governance requests.
9. **Rebrand & redeploy** — set `BRAND_NAME` + env; instance N+1 is configuration (STRATEGY.md §4).

Any stage that makes the developer stop and read source to proceed is a DX bug to fix in
the build, not a documentation gap to paper over later.

---

## 10. Out of scope here (owned elsewhere)

Scope and deferrals: PRD.md §6 / SCOPE.json. Positioning and metrics: STRATEGY.md. File
tree, API surface, data model, build sequence: PLAN.md. Decisions and security posture:
ARCHITECTURE.md. Visual system, screen states, accessibility tokens: DESIGN.md. This
document adds only the developer-experience and maintainability contract layered over them.
