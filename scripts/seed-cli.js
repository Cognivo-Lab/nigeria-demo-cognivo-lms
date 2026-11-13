// CLI: apply migrations and seed demo data. Usage: npm run seed
// Honours DATABASE_URL (real Postgres) or falls back to the embedded engine.
import { createPool, connectWithRetry } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/seed.js';
import { log } from '../src/log.js';

const seedPassword = process.env.SEED_PASSWORD || 'change-me';

const run = async () => {
  const pool = await createPool();
  await connectWithRetry(pool, { log });
  const applied = await migrate(pool, { log });
  const result = await seed(pool, { seedPassword, log });
  log.info({ msg: 'seed-cli complete', migrationsApplied: applied, seeded: result.seeded });
  await pool.end?.();
  process.exit(0);
};

run().catch((err) => { log.error({ msg: 'seed-cli failed', error: err.message }); process.exit(1); });
