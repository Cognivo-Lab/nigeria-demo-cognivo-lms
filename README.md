# Cognivo LMS

A Coursera-style **learning management platform** demo. Browse a catalogue of
30+ courses across six domains, learn through video and downloadable readings,
take quizzes, pass a certification test to earn a certificate, leave
completion-gated feedback, follow an AI-built learning roadmap, and track
progress on a calendar — with tailored, exportable dashboards for **potential
learners, registered learners, course providers and the platform owner**.

The demo requires **no login**: pick a persona button to explore. Underneath,
authentication, role-based access control and tenant isolation are real and
enforced on the server in every profile.

## Quick start

```bash
npm install
# Demo profile: seeds a catalogue + demo logins, runs anywhere (no database needed)
APP_PROFILE=demo SEED_PASSWORD=change-me npm start
# open http://localhost:3000
```

With no `DATABASE_URL`, an embedded Postgres-compatible engine is used so it runs
with zero external services. For a real deployment, provide Postgres:

```bash
export DATABASE_URL=postgres://user:pass@host:5432/cognivo
export APP_PROFILE=production      # starts empty, bootstraps an owner
export OWNER_EMAIL=owner@you.com SEED_PASSWORD=strong-secret
npm start
```

On boot the app connects (with retry/backoff), applies migrations, and — in the
demo profile — seeds sample data. It binds `0.0.0.0:$PORT` (default 3000; 8080 in
the container).

## Configuration

Every variable is read from the environment and documented in
[`.env.example`](./.env.example). Key ones:

| Variable | Purpose |
| --- | --- |
| `APP_PROFILE` | `demo` (seeded) or `production` (empty + first-run owner). |
| `DATABASE_URL` | Postgres connection string. Unset ⇒ embedded engine. |
| `SEED_PASSWORD` | Password for demo accounts / bootstrap owner. Random if unset (printed once to the log). |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | First-run owner for a production install. |
| `BRAND_NAME` | White-label product name (header, `<title>`, footer). |
| `OIDC_*` | Optional SSO (OpenID Connect); SSO button hidden when unset. |

## Demo logins

Local sign-in works for the seeded accounts (password = `SEED_PASSWORD`):

| Role | Email |
| --- | --- |
| Platform owner | `owner@nigeria-demo.cognivo` |
| Course provider | `provider@nigeria-demo.cognivo` |
| Registered learner | `learner@nigeria-demo.cognivo` |

## Scripts

- `npm start` — run the server (migrates + seeds per profile).
- `npm run seed` — apply migrations and seed demo data (idempotent).
- `npm test` — unit + API integration tests (incl. auth/RBAC denials), run with
  the embedded engine so no database is required. One command, deterministic.

## Architecture

Express + a hand-written, parameterised repository layer over Postgres; a vanilla
SPA front end (marketing front door at `/`, the demo app behind persona
selection). See [ARCHITECTURE.md](./ARCHITECTURE.md), [PLAN.md](./PLAN.md) and
[DESIGN.md](./DESIGN.md). Operations (install, uninstall, backup/restore, health)
are in [OPERATIONS.md](./OPERATIONS.md).

## Health

`GET /health` checks the database dependency and returns `200`/`503`; wired to the
container `HEALTHCHECK`.
