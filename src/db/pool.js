// Database pool. Uses a real Postgres (node-postgres) when DATABASE_URL is set;
// otherwise an embedded, in-process Postgres-compatible engine (pg-mem) so the
// product boots and the full test suite runs with zero external services
// (local dev, CI, and "demo anywhere"). The SQL, schema and repository code are
// identical across both — see ARCHITECTURE.md §8.

import pg from 'pg';

let memMod = null; // lazily imported so pg-mem is never loaded in production

export function usingRealPostgres() {
  return !!process.env.DATABASE_URL;
}

export async function createPool() {
  if (usingRealPostgres()) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    // Surface pool-level errors instead of crashing the process.
    pool.on('error', (err) => {
      console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg: 'pg pool error', error: err.message }));
    });
    return pool;
  }
  if (!memMod) memMod = await import('pg-mem');
  const db = memMod.newDb();
  const adapter = db.adapters.createPg();
  const pool = new adapter.Pool();
  pool.__isMemory = true;
  return pool;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry the first connection with exponential backoff so the app tolerates a
// cold database after a host reboot (app/DB start order is undefined).
export async function connectWithRetry(pool, { attempts = 10, baseDelayMs = 500, log = console } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return;
    } catch (err) {
      lastErr = err;
      const delay = Math.min(baseDelayMs * 2 ** (i - 1), 10000);
      log.warn?.({ msg: 'database not ready, retrying', attempt: i, attempts, delayMs: delay });
      if (i < attempts) await sleep(delay);
    }
  }
  throw new Error(`Database unreachable after ${attempts} attempts: ${lastErr && lastErr.message}`);
}
