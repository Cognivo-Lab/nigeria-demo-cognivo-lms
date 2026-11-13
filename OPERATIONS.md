# Operations — Cognivo LMS

## Install (production)

1. Provision Postgres and export `DATABASE_URL`.
2. Set `APP_PROFILE=production`, a strong `SEED_PASSWORD` (or `OWNER_PASSWORD`),
   and `OWNER_EMAIL` for the first owner account.
3. `npm ci --omit=dev && npm start` (or build the container image below).

On boot the app retries the DB connection with backoff, applies all pending
migrations from `src/db/migrations/`, and — in production — bootstraps the owner
account if none exists. First-run configuration is reachable in-app; no file
editing required.

### Container

```bash
docker build -t cognivo-lms .
docker run -p 8080:8080 \
  -e DATABASE_URL=postgres://user:pass@db:5432/cognivo \
  -e APP_PROFILE=production -e OWNER_EMAIL=owner@you.com -e SEED_PASSWORD=secret \
  cognivo-lms
```

The image ships `APP_PROFILE=demo` by default (seeded, evaluate-anywhere);
override it for production. `HEALTHCHECK` probes `GET /health`.

## Demo profile

`APP_PROFILE=demo` seeds 32 courses, 40 learners and a broad history of
completions, certificates, test results and feedback, plus three demo logins
(owner/provider/learner, password `SEED_PASSWORD`). Re-seed an empty database at
any time with `npm run seed` (idempotent — it no-ops if courses already exist).

## Backup & restore

Standard Postgres tooling (all data lives in one database):

```bash
# Backup
pg_dump "$DATABASE_URL" --no-owner --format=custom -f cognivo-backup.dump
# Restore (into an empty database)
pg_restore --no-owner --clean --if-exists -d "$DATABASE_URL" cognivo-backup.dump
```

Migrations are idempotent and tracked in `schema_migrations`, so restoring an
older dump and starting the app re-applies any newer migrations automatically.

## Uninstall (clean removal of product data)

```bash
# Drops every table this product owns. Irreversible — back up first.
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

Then remove the container/image. With the embedded engine (no `DATABASE_URL`)
there is nothing to clean up — data lives only in memory for the process
lifetime.

## Health & monitoring

- `GET /health` — checks the database dependency (`200` ok / `503` down).
- `GET /healthz` — liveness.
- Structured JSON logs to stdout with a `level` and `time`; no secrets or PII are
  logged. The in-app **audit log** (owner-viewable at `/api/admin/audit`) records
  privileged actions (certificate issuance, exports, downloads, logins).

## Graceful shutdown

The server handles `SIGTERM`/`SIGINT`, stops accepting connections and exits
(with a 5s hard cap), so rolling deploys and container stops are clean.
