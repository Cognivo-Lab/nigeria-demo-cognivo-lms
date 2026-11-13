import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Run the suite against the demo profile with the embedded Postgres-compatible
// engine (no DATABASE_URL) so it needs zero external services.
process.env.APP_PROFILE = 'demo';
process.env.SEED_PASSWORD = process.env.SEED_PASSWORD || 'SEED_PASSWORD';
delete process.env.DATABASE_URL;

const { createApp } = await import('../src/server.js');

let server, base, pool, demoLearnerId;

const SEED_PW = process.env.SEED_PASSWORD;
const OWNER_EMAIL = 'owner@nigeria-demo.cognivo';

// Stable seed slugs used by the tests.
const INTRO = 'intro-to-data-literacy';           // demo learner has completed this
const FS_WEB = 'full-stack-web-development';       // forge-labs course
const ALGO = 'algorithms-and-data-structures';     // forge-labs course
const SECSW = 'secure-software-development';        // forge-labs course
const AML = 'applied-machine-learning';            // nova course

before(async () => {
  const built = await createApp();
  pool = built.pool;
  await new Promise((resolve) => { server = built.app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
  const meta = await (await fetch(base + '/api/meta')).json();
  demoLearnerId = meta.demoLearnerId;
});
after(async () => {
  await new Promise((r) => server.close(r));
  try { await pool.end(); } catch { /* pg-mem pool may lack end */ }
});

const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.json().catch(() => null) }; };
const post = async (p, body) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

test('GET /healthz returns 200 and reports ok', async () => {
  const r = await get('/healthz');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
});

test('GET /health checks the database dependency', async () => {
  const r = await get('/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.db, 'ok');
});

test('security headers are present', async () => {
  const r = await fetch(base + '/healthz');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.ok(r.headers.get('content-security-policy').includes("default-src 'self'"));
});

test('catalogue lists 30+ courses and supports search + filters', async () => {
  const all = await get('/api/courses');
  assert.ok(all.body.length >= 30, `expected 30+ courses, got ${all.body.length}`);
  const search = await get('/api/courses?q=machine');
  assert.ok(search.body.length >= 1);
  assert.ok(search.body.every((c) => /machine/i.test(c.title + c.summary)));
  const byDomain = await get('/api/courses?domain=security');
  assert.ok(byDomain.body.length >= 1);
  assert.ok(byDomain.body.every((c) => c.domainId === 'security'));
});

test('course detail exposes lessons, quiz and test meta but no answers', async () => {
  const r = await get('/api/courses/' + INTRO);
  assert.equal(r.status, 200);
  assert.ok(r.body.lessons.length > 0);
  assert.ok(r.body.quiz.every((q) => !('answer' in q)));
  assert.ok(r.body.test.passScore >= 1);
  const tq = await get('/api/courses/' + INTRO + '/test-questions');
  assert.ok(tq.body.questions.every((q) => !('answer' in q)));
});

test('feedback is gated: non-completers rejected, completers accepted', async () => {
  const denied = await post('/api/courses/' + INTRO + '/feedback', { learnerId: 'ghost-learner', score: 5, comment: 'hi' });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, 'not_completed');

  const ok = await post('/api/courses/' + INTRO + '/feedback', { learnerId: demoLearnerId, score: 4, comment: 'Great course' });
  assert.ok(ok.status === 200 || ok.status === 201);
});

test('completing lessons unlocks the course and then the certification test', async () => {
  const learnerId = 'test-learner-x';
  const course = (await get('/api/courses/' + ALGO)).body;

  const locked = await post('/api/courses/' + ALGO + '/test', { learnerId, answers: {} });
  assert.equal(locked.status, 403);

  let prog;
  for (const l of course.lessons) {
    prog = (await post('/api/courses/' + ALGO + '/complete-lesson', { learnerId, lessonId: l.id })).body;
  }
  assert.equal(prog.completed, true);
  assert.equal(prog.percent, 100);

  const tq = (await get('/api/courses/' + ALGO + '/test-questions')).body;
  const answers = {};
  for (const q of tq.questions) answers[q.id] = 1; // seed answers are index 1
  const result = await post('/api/courses/' + ALGO + '/test', { learnerId, answers });
  assert.equal(result.status, 200);
  assert.equal(result.body.passed, true);
  assert.ok(result.body.certificate);

  const dash = (await get('/api/learners/' + learnerId + '/dashboard')).body;
  assert.ok(dash.certificates.some((c) => c.courseId === ALGO));
  assert.ok(dash.stats.completed >= 1);
});

test('failing the test does not issue a certificate', async () => {
  const learnerId = 'test-learner-fail';
  const course = (await get('/api/courses/' + SECSW)).body;
  for (const l of course.lessons) await post('/api/courses/' + SECSW + '/complete-lesson', { learnerId, lessonId: l.id });
  const tq = (await get('/api/courses/' + SECSW + '/test-questions')).body;
  const answers = {};
  for (const q of tq.questions) answers[q.id] = 0; // wrong
  const result = await post('/api/courses/' + SECSW + '/test', { learnerId, answers });
  assert.equal(result.body.passed, false);
  assert.equal(result.body.certificate, null);
});

test('provider can reply to feedback on own course; outsiders cannot', async () => {
  const learnerId = 'test-learner-fb';
  const course = (await get('/api/courses/' + FS_WEB)).body; // forge-labs
  for (const l of course.lessons) await post('/api/courses/' + FS_WEB + '/complete-lesson', { learnerId, lessonId: l.id });
  const fb = await post('/api/courses/' + FS_WEB + '/feedback', { learnerId, score: 5, comment: 'loved it' });
  const fbId = fb.body.id;

  const wrong = await post(`/api/feedback/${fbId}/reply`, { providerId: 'nova', body: 'hi' });
  assert.equal(wrong.status, 403);

  const right = await post(`/api/feedback/${fbId}/reply`, { providerId: 'forge-labs', body: 'Thanks!' });
  assert.equal(right.status, 201);

  const detail = (await get('/api/courses/' + FS_WEB)).body;
  const item = detail.feedback.find((f) => f.id === fbId);
  assert.ok(item.replies.length >= 1);
});

test('wishlist add/list/remove', async () => {
  const learnerId = 'test-learner-wl';
  await post('/api/learners/' + learnerId + '/wishlist', { courseId: AML });
  let wl = (await get('/api/learners/' + learnerId + '/wishlist')).body;
  assert.equal(wl.length, 1);
  assert.equal(wl[0].id, AML);
  const del = await fetch(base + '/api/learners/' + learnerId + '/wishlist/' + AML, { method: 'DELETE' });
  assert.equal((await del.json()).removed, true);
  wl = (await get('/api/learners/' + learnerId + '/wishlist')).body;
  assert.equal(wl.length, 0);
});

test('learner dashboard includes an AI roadmap with ordered steps + calendar', async () => {
  const dash = (await get('/api/learners/' + demoLearnerId + '/dashboard')).body;
  assert.ok(dash.roadmap);
  assert.ok(Array.isArray(dash.roadmap.steps));
  assert.ok(dash.roadmap.steps.length >= 1);
  assert.equal(dash.roadmap.steps[0].order, 1);
  assert.ok(Array.isArray(dash.calendar));
});

test('provider dashboard aggregates wishlist, completion and certification', async () => {
  const d = (await get('/api/providers/forge-labs/dashboard')).body;
  assert.ok(d.totals.courses >= 1);
  assert.ok('wishlisted' in d.totals);
  assert.ok(Array.isArray(d.courses));
  assert.ok(Array.isArray(d.threads));
});

test('owner dashboard reports completion and test pass rates with trend data', async () => {
  const d = (await get('/api/owner/dashboard')).body;
  assert.ok(d.kpis.learners >= 1);
  assert.ok(d.kpis.completionRate >= 0 && d.kpis.completionRate <= 100);
  assert.ok(d.kpis.testPassRate >= 0 && d.kpis.testPassRate <= 100);
  assert.equal(d.trend.length, 6);
  assert.ok(d.byDomain.length >= 1);
});

test('recommendations exclude already-enrolled courses for a learner', async () => {
  const recs = (await get('/api/recommendations?learnerId=' + demoLearnerId)).body;
  const enrolled = (await get('/api/learners/' + demoLearnerId + '/dashboard')).body;
  const enrolledIds = new Set([...enrolled.completed, ...enrolled.inProgress].map((c) => c.id));
  assert.ok(recs.length > 0);
  assert.ok(recs.every((c) => !enrolledIds.has(c.id)));
});

test('POST /api/auth/login authenticates the owner and sets a session cookie', async () => {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: SEED_PW }),
  });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.email, OWNER_EMAIL);
  assert.equal(body.role, 'owner');
  const setCookie = r.headers.get('set-cookie') || '';
  assert.match(setCookie, /cognivo_session=/);
  assert.match(setCookie, /HttpOnly/i);
});

test('POST /api/auth/login rejects a bad password with 401', async () => {
  const r = await post('/api/auth/login', { email: OWNER_EMAIL, password: 'wrong-password' });
  assert.equal(r.status, 401);
  assert.equal(r.body.error, 'invalid_credentials');
});

const loginCookie = async () => {
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: SEED_PW }),
  });
  return (login.headers.get('set-cookie') || '').split(';')[0];
};

test('GET /api/auth/me returns the signed-in user and 401 without a session', async () => {
  const anon = await get('/api/auth/me');
  assert.equal(anon.status, 401);
  const cookie = await loginCookie();
  const me = await fetch(base + '/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).email, OWNER_EMAIL);
});

test('protected routes reject anonymous callers (401) and roles (403)', async () => {
  for (const p of ['/api/wishlist', '/api/enrollments', '/api/certificates', '/api/calendar', '/api/owner/overview', '/api/provider/overview', '/api/courses/' + INTRO + '/player']) {
    const r = await get(p);
    assert.equal(r.status, 401, `${p} should be 401 for anonymous`);
  }
  // owner cookie cannot reach the provider overview
  const cookie = await loginCookie();
  const asProvider = await fetch(base + '/api/provider/overview', { headers: { Cookie: cookie } });
  assert.equal(asProvider.status, 403);
});

test('owner can load overview, CSV export and audit log when signed in', async () => {
  const cookie = await loginCookie();
  const ov = await fetch(base + '/api/owner/overview', { headers: { Cookie: cookie } });
  assert.equal(ov.status, 200);
  const csv = await fetch(base + '/api/exports/owner.csv', { headers: { Cookie: cookie } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type') || '', /csv/);
  const audit = await fetch(base + '/api/admin/audit', { headers: { Cookie: cookie } });
  assert.equal(audit.status, 200);
});

test('demo personas endpoint lists the four personas', async () => {
  const r = await get('/api/auth/demo/personas');
  assert.equal(r.status, 200);
  const roles = r.body.personas.map((p) => p.role);
  assert.ok(['guest', 'learner', 'provider', 'owner'].every((x) => roles.includes(x)));
});

test('data export returns the learner record and writes an audit entry', async () => {
  const r = await get('/api/learners/' + demoLearnerId + '/export');
  assert.equal(r.status, 200);
  assert.equal(r.body.learner.id, demoLearnerId);
  assert.ok(Array.isArray(r.body.enrollments));
  const audit = (await get('/api/governance/audit')).body;
  assert.ok(audit.some((a) => a.action === 'data.export'));
});
