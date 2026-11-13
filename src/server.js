import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { createPool, connectWithRetry, usingRealPostgres } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { seed, ensureOwner } from './seed.js';
import { createRepo } from './repo.js';
import { verifyPassword } from './password.js';
import { buildRoadmap } from './roadmap.js';
import { log } from './log.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// White-label brand name — single source of truth, from the environment.
const BRAND_NAME = process.env.BRAND_NAME || 'Cognivo LMS';
const BRAND_SLUG = BRAND_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cognivo-lms';
const SESSION_COOKIE = 'cognivo_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Resolve the configuration needed to boot, failing loudly for production.
function resolveConfig() {
  const profile = (process.env.APP_PROFILE || 'production').toLowerCase();
  let seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    seedPassword = crypto.randomBytes(12).toString('base64url');
    log.warn({ msg: 'SEED_PASSWORD not set; generated a random one for seeded/first-run accounts', seedPassword });
  }
  if (profile === 'production' && usingRealPostgres()) {
    // Owner bootstrap for an empty production install (optional; first-run UI also covers it).
    if (process.env.OWNER_EMAIL && !process.env.OWNER_PASSWORD && !process.env.SEED_PASSWORD) {
      throw new Error('OWNER_EMAIL set without OWNER_PASSWORD or SEED_PASSWORD — refusing to boot');
    }
  }
  return { profile, seedPassword };
}

export async function createApp(opts = {}) {
  const config = opts.config || resolveConfig();
  const pool = opts.pool || (await createPool());
  await connectWithRetry(pool, { log });
  await migrate(pool, { log });

  if (config.profile === 'demo') {
    await seed(pool, { seedPassword: config.seedPassword, log });
  } else {
    // Production: start empty; bootstrap an owner from env if provided.
    const ownerEmail = process.env.OWNER_EMAIL;
    if (ownerEmail) {
      await ensureOwner(pool, { email: ownerEmail, password: process.env.OWNER_PASSWORD || config.seedPassword, log });
    }
  }

  const repo = createRepo(pool);
  const app = express();
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  // ---- Security & governance headers ----
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data:; media-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'"
    );
    next();
  });

  // Wrap an async handler so rejections become a clean 500 (no internal leak).
  const h = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
    log.error({ msg: 'request failed', path: req.path, error: err.message });
    if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
  });

  // ---- cookies ----
  const parseCookies = (req) => {
    const out = {};
    const header = req.headers.cookie;
    if (!header) return out;
    for (const part of header.split(';')) {
      const i = part.indexOf('=');
      if (i < 0) continue;
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  };
  const isHttps = (req) => {
    const proto = (req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http'));
    return String(proto).split(',')[0].trim() === 'https';
  };
  const setSessionCookie = (req, res, token, maxAgeSec) => {
    const secure = isHttps(req) ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure}`);
  };
  const currentSession = (req) => repo.getSession(parseCookies(req)[SESSION_COOKIE]);

  const requireAuth = async (req, res) => {
    const s = await currentSession(req);
    if (!s) { res.status(401).json({ error: 'unauthenticated' }); return null; }
    return s;
  };
  const requireRole = async (req, res, role) => {
    const s = await requireAuth(req, res);
    if (!s) return null;
    if (s.role !== role) { res.status(403).json({ error: 'forbidden' }); return null; }
    return s;
  };

  // ---- derived-data helpers over a loaded snapshot ----
  function helpers(state) {
    const courseById = (id) => state.courses.find((c) => c.id === id);
    const providerName = (id) => (state.providers.find((p) => p.id === id) || {}).name || 'Unknown';
    const domainName = (id) => (state.domains.find((d) => d.id === id) || {}).name || 'General';
    const learnerName = (id) => (state.learners.find((l) => l.id === id) || {}).name || 'Learner';
    const courseRating = (courseId) => {
      const fbs = state.feedback.filter((f) => f.courseId === courseId);
      if (!fbs.length) return { avg: null, count: 0 };
      const avg = fbs.reduce((s, f) => s + f.score, 0) / fbs.length;
      return { avg: Math.round(avg * 10) / 10, count: fbs.length };
    };
    const courseCard = (c) => {
      const r = courseRating(c.id);
      return {
        id: c.id, title: c.title, summary: c.summary, level: c.level, format: c.format,
        durationHrs: c.durationHrs, domainId: c.domainId, domain: domainName(c.domainId),
        providerId: c.providerId, provider: providerName(c.providerId),
        lessonCount: c.lessons.length, rating: r.avg, ratingCount: r.count,
        enrolledCount: state.enrollments.filter((e) => e.courseId === c.id).length,
      };
    };
    const progressFor = (learnerId, courseId) => {
      const c = courseById(courseId);
      const e = state.enrollments.find((x) => x.learnerId === learnerId && x.courseId === courseId);
      const done = e ? e.completedLessonIds.length : 0;
      const total = c ? c.lessons.length : 0;
      return {
        enrolled: !!e, completed: e ? e.completed : false,
        completedLessonIds: e ? e.completedLessonIds : [],
        done, total, percent: total ? Math.round((done / total) * 100) : 0,
      };
    };
    return { courseById, providerName, domainName, learnerName, courseRating, courseCard, progressFor };
  }

  const filterCatalogue = (list, query) => {
    const { q, domain, level, sort } = query;
    let out = list;
    if (q) {
      const term = String(q).toLowerCase();
      out = out.filter((c) =>
        c.title.toLowerCase().includes(term) || c.summary.toLowerCase().includes(term) ||
        c.provider.toLowerCase().includes(term) || c.domain.toLowerCase().includes(term));
    }
    if (domain) out = out.filter((c) => c.domainId === domain);
    if (level) out = out.filter((c) => c.level === level);
    if (sort === 'rating') out = [...out].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else if (sort === 'popular') out = [...out].sort((a, b) => b.enrolledCount - a.enrolledCount);
    return out;
  };

  // ======================= Health & meta =======================
  app.get('/healthz', h(async (req, res) => {
    try { await repo.ping(); res.status(200).json({ status: 'ok', uptime: process.uptime() }); }
    catch { res.status(503).json({ status: 'unavailable' }); }
  }));
  app.get('/health', h(async (req, res) => {
    try {
      await repo.ping();
      res.status(200).json({ status: 'ok', db: 'ok', store: usingRealPostgres() ? 'postgres' : 'embedded', uptime: process.uptime() });
    } catch (err) {
      res.status(503).json({ status: 'unavailable', db: 'down' });
    }
  }));

  app.get('/api/brand', h(async (req, res) => {
    res.json({
      brandName: BRAND_NAME, productName: BRAND_NAME,
      tagline: 'Learn without limits.',
      supportEmail: process.env.BRAND_SUPPORT_EMAIL || 'support@cognivo.demo',
    });
  }));

  app.get('/api/meta', h(async (req, res) => {
    const accounts = await repo.listDemoAccounts();
    const learnerAcct = accounts.find((a) => a.role === 'learner');
    const providerAcct = accounts.find((a) => a.role === 'provider');
    res.json({
      name: BRAND_NAME,
      personas: [
        { id: 'guest', label: 'Potential Learner', desc: 'Browse the public catalogue' },
        { id: 'learner', label: 'Registered Learner', desc: learnerAcct ? learnerAcct.name : 'Registered Learner' },
        { id: 'provider', label: 'Course Provider', desc: providerAcct ? providerAcct.name : 'Course Provider' },
        { id: 'owner', label: 'Platform Owner', desc: 'Platform-wide analytics' },
      ],
      demoLearnerId: learnerAcct ? learnerAcct.learnerId : null,
      demoProviderId: providerAcct ? providerAcct.providerId : null,
    });
  }));

  app.get('/api/auth/demo/personas', h(async (req, res) => {
    const accounts = await repo.listDemoAccounts();
    const byRole = (r) => accounts.find((a) => a.role === r);
    const learnerAcct = byRole('learner');
    const providerAcct = byRole('provider');
    const ownerAcct = byRole('owner');
    res.json({
      personas: [
        { id: 'guest', role: 'guest', label: 'Potential Learner', email: null, description: 'Browse the public catalogue' },
        { id: learnerAcct ? learnerAcct.learnerId : 'learner', role: 'learner', label: 'Registered Learner', email: learnerAcct ? learnerAcct.email : null, description: learnerAcct ? learnerAcct.name : 'Registered Learner' },
        { id: providerAcct ? providerAcct.id : 'provider', role: 'provider', label: 'Course Provider', email: providerAcct ? providerAcct.email : null, description: providerAcct ? providerAcct.name : 'Course Provider' },
        { id: ownerAcct ? ownerAcct.id : 'owner', role: 'owner', label: 'Platform Owner', email: ownerAcct ? ownerAcct.email : null, description: 'Platform-wide analytics' },
      ],
    });
  }));

  // ======================= Auth & session =======================
  app.post('/api/auth/login', h(async (req, res) => {
    const { email, password } = req.body || {};
    const acct = await repo.findAccountByEmail(String(email || '').trim().toLowerCase());
    if (!acct || !verifyPassword(String(password == null ? '' : password), acct.passwordHash)) {
      await repo.audit('auth.login.failed', { email: String(email || '').slice(0, 120) });
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const { token, data } = await repo.createSession(acct, SESSION_TTL_MS);
    setSessionCookie(req, res, token, SESSION_TTL_MS / 1000);
    await repo.audit('auth.login', { email: acct.email, role: acct.role });
    res.json(data);
  }));

  app.get('/api/auth/me', h(async (req, res) => {
    const s = await currentSession(req);
    if (!s) return res.status(401).json({ error: 'unauthenticated' });
    res.json(s);
  }));

  app.post('/api/auth/logout', h(async (req, res) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    await repo.deleteSession(token);
    setSessionCookie(req, res, '', 0);
    res.json({ ok: true });
  }));

  // ======================= Catalogue (public) =======================
  app.get('/api/domains', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json(state.domains.map((d) => ({ ...d, courseCount: state.courses.filter((c) => c.domainId === d.id).length })));
  }));

  app.get('/api/courses', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseCard } = helpers(state);
    res.json(filterCatalogue(state.courses.map(courseCard), req.query));
  }));

  app.get('/api/catalog/courses', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseCard } = helpers(state);
    const list = filterCatalogue(state.courses.map(courseCard), req.query);
    res.json({ courses: list, total: list.length });
  }));

  app.get('/api/catalog/domains', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json({ domains: state.domains.map((d) => ({ ...d, courseCount: state.courses.filter((c) => c.domainId === d.id).length })) });
  }));

  const recommend = (state, learnerId, limit) => {
    const { courseCard, courseRating, courseById } = helpers(state);
    const takenDomains = learnerId
      ? new Set(state.enrollments.filter((e) => e.learnerId === learnerId).map((e) => (courseById(e.courseId) || {}).domainId))
      : new Set();
    const scored = state.courses.map((c) => {
      const r = courseRating(c.id);
      let score = (r.avg || 3) * 2 + state.enrollments.filter((e) => e.courseId === c.id).length * 0.2;
      if (learnerId) {
        if (state.enrollments.find((e) => e.learnerId === learnerId && e.courseId === c.id)) score -= 100;
        if (takenDomains.has(c.domainId)) score += 3;
      }
      return { c, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => courseCard(s.c));
  };

  app.get('/api/recommendations', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json(recommend(state, req.query.learnerId, 4));
  }));
  app.get('/api/catalog/recommendations', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json({ courses: recommend(state, req.query.learnerId, 6) });
  }));

  app.get('/api/courses/:id', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById, courseCard, courseRating, learnerName, providerName, progressFor } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    const learnerId = req.query.learnerId;
    const r = courseRating(c.id);
    res.json({
      ...courseCard(c),
      description: c.summary,
      lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type, durationMin: l.durationMin, url: l.url, downloadable: l.downloadable, body: l.body })),
      quiz: c.quiz.map((qq) => ({ id: qq.id, prompt: qq.prompt, options: qq.options })),
      test: { id: c.test.id, title: c.test.title, passScore: c.test.passScore, questionCount: c.test.questions.length },
      rating: r,
      feedback: state.feedback.filter((f) => f.courseId === c.id).map((f) => ({
        id: f.id, learner: learnerName(f.learnerId), score: f.score, comment: f.comment, createdAt: f.createdAt,
        replies: f.replies.map((rp) => ({ id: rp.id, provider: providerName(rp.providerId), body: rp.body, createdAt: rp.createdAt })),
      })),
      progress: learnerId ? progressFor(learnerId, c.id) : null,
    });
  }));

  app.get('/api/courses/:id/feedback', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById, courseRating, learnerName, providerName } = helpers(state);
    const c = courseById(req.params.id);
    const rating = c ? courseRating(c.id) : { avg: null, count: 0 };
    const feedback = (c ? state.feedback.filter((f) => f.courseId === c.id) : []).map((f) => ({
      id: f.id, learner: learnerName(f.learnerId), score: f.score, comment: f.comment, createdAt: f.createdAt,
      replies: f.replies.map((rp) => ({ id: rp.id, provider: providerName(rp.providerId), body: rp.body, createdAt: rp.createdAt })),
    }));
    res.json({ courseId: req.params.id, rating, feedback });
  }));

  app.get('/api/courses/:id/lessons/:lessonId/download', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    const lesson = c.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson || !lesson.downloadable) return res.status(404).json({ error: 'not_downloadable' });
    await repo.audit('reading.download', { courseId: c.id, lessonId: lesson.id });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${lesson.id}.txt"`);
    res.send(`${c.title}\n${lesson.title}\n\n${lesson.body}\n`);
  }));

  app.get('/api/courses/:id/test-questions', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    res.json({
      title: c.test.title, passScore: c.test.passScore,
      questions: c.test.questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
    });
  }));

  // ======================= Learning actions =======================
  app.post('/api/courses/:id/complete-lesson', h(async (req, res) => {
    const { learnerId, lessonId } = req.body || {};
    let state = await repo.snapshot();
    const { courseById, progressFor } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    if (!learnerId || !lessonId) return res.status(400).json({ error: 'missing_fields' });
    if (!c.lessons.find((l) => l.id === lessonId)) return res.status(400).json({ error: 'bad_lesson' });
    const { justCompleted } = await repo.completeLesson(learnerId, c.id, lessonId, c.lessons.length);
    if (justCompleted) await repo.audit('course.completed', { learnerId, courseId: c.id });
    state = await repo.snapshot();
    res.json(helpers(state).progressFor(learnerId, c.id));
  }));

  app.post('/api/courses/:id/quiz', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    const answers = (req.body && req.body.answers) || {};
    let correct = 0;
    for (const q of c.quiz) if (answers[q.id] === q.answer) correct++;
    res.json({ correct, total: c.quiz.length, score: c.quiz.length ? Math.round((correct / c.quiz.length) * 100) : 0 });
  }));

  // Feedback — GATED: only learners who completed the course.
  app.post('/api/courses/:id/feedback', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById, progressFor } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    const { learnerId, score, comment } = req.body || {};
    if (!learnerId) return res.status(400).json({ error: 'missing_learner' });
    if (!progressFor(learnerId, c.id).completed) {
      return res.status(403).json({ error: 'not_completed', message: 'Complete the course before leaving feedback.' });
    }
    const s = Number(score);
    if (!(s >= 1 && s <= 5)) return res.status(400).json({ error: 'bad_score' });
    const result = await repo.upsertFeedback(learnerId, c.id, s, String(comment || '').slice(0, 2000));
    await repo.audit(result.updated ? 'feedback.updated' : 'feedback.created', { learnerId, courseId: c.id });
    res.status(result.updated ? 200 : 201).json(result);
  }));

  // Provider replies to feedback on their own course.
  app.post('/api/feedback/:fbId/reply', h(async (req, res) => {
    const { providerId, body } = req.body || {};
    const fb = await repo.getFeedbackWithCourse(req.params.fbId);
    if (!fb) return res.status(404).json({ error: 'not_found' });
    if (!providerId || providerId !== fb.provider_id) return res.status(403).json({ error: 'not_course_provider' });
    if (!body || !String(body).trim()) return res.status(400).json({ error: 'empty' });
    const reply = await repo.addReply(fb.id, providerId, String(body).slice(0, 2000));
    await repo.audit('feedback.reply', { providerId, feedbackId: fb.id });
    res.status(201).json(reply);
  }));

  // Certification test — GATED: must have completed the course.
  app.post('/api/courses/:id/test', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById, progressFor } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    const { learnerId, answers } = req.body || {};
    if (!learnerId) return res.status(400).json({ error: 'missing_learner' });
    if (!progressFor(learnerId, c.id).completed) {
      return res.status(403).json({ error: 'not_completed', message: 'Finish all lessons before taking the certification test.' });
    }
    const a = answers || {};
    let correct = 0;
    for (const q of c.test.questions) if (a[q.id] === q.answer) correct++;
    const score = c.test.questions.length ? Math.round((correct / c.test.questions.length) * 100) : 0;
    const passed = score >= c.test.passScore;
    const { certificate } = await repo.recordTest(learnerId, c.id, score, passed);
    if (passed) await repo.audit('certificate.issued', { learnerId, courseId: c.id, score });
    res.json({ score, passed, passScore: c.test.passScore, certificate });
  }));

  // ======================= Wishlist (persona-scoped, used by demo + tests) =======================
  app.get('/api/learners/:id/wishlist', h(async (req, res) => {
    const state = await repo.snapshot();
    const { courseById, courseCard } = helpers(state);
    const items = state.wishlist.filter((w) => w.learnerId === req.params.id);
    res.json(items.map((w) => ({ ...courseCard(courseById(w.courseId)), addedAt: w.addedAt })));
  }));
  app.post('/api/learners/:id/wishlist', h(async (req, res) => {
    const { courseId } = req.body || {};
    if (!(await repo.courseExists(courseId))) return res.status(400).json({ error: 'bad_course' });
    await repo.addWishlist(req.params.id, courseId);
    await repo.audit('wishlist.add', { learnerId: req.params.id, courseId });
    res.status(201).json({ ok: true });
  }));
  app.delete('/api/learners/:id/wishlist/:courseId', h(async (req, res) => {
    const result = await repo.removeWishlist(req.params.id, req.params.courseId);
    res.json(result);
  }));

  // ======================= Signed-in learner surfaces (401 anonymous) =======================
  app.get('/api/wishlist', h(async (req, res) => {
    const s = await requireAuth(req, res); if (!s) return;
    const state = await repo.snapshot();
    const { courseById, courseCard } = helpers(state);
    const lid = s.learnerId || s.id;
    const items = state.wishlist.filter((w) => w.learnerId === lid).map((w) => ({ ...courseCard(courseById(w.courseId)), addedAt: w.addedAt }));
    res.json({ items, total: items.length });
  }));
  app.get('/api/enrollments', h(async (req, res) => {
    const s = await requireAuth(req, res); if (!s) return;
    const state = await repo.snapshot();
    const { courseById, courseCard, progressFor } = helpers(state);
    const lid = s.learnerId || s.id;
    const items = state.enrollments.filter((e) => e.learnerId === lid).map((e) => ({ ...courseCard(courseById(e.courseId)), ...progressFor(lid, e.courseId), startedAt: e.startedAt, completedAt: e.completedAt }));
    res.json({ enrollments: items, total: items.length });
  }));
  app.get('/api/certificates', h(async (req, res) => {
    const s = await requireAuth(req, res); if (!s) return;
    const state = await repo.snapshot();
    const { courseById, providerName } = helpers(state);
    const lid = s.learnerId || s.id;
    const items = state.certificates.filter((c) => c.learnerId === lid).map((c) => ({ id: c.id, courseId: c.courseId, course: (courseById(c.courseId) || {}).title, provider: providerName((courseById(c.courseId) || {}).providerId), issuedAt: c.issuedAt, score: c.score }));
    res.json({ certificates: items, total: items.length });
  }));
  app.get('/api/calendar', h(async (req, res) => {
    const s = await requireAuth(req, res); if (!s) return;
    const state = await repo.snapshot();
    const { courseById } = helpers(state);
    const lid = s.learnerId || s.id;
    const events = [];
    for (const e of state.enrollments.filter((e) => e.learnerId === lid)) {
      events.push({ date: e.startedAt, type: 'started', course: (courseById(e.courseId) || {}).title });
      if (e.completedAt) events.push({ date: e.completedAt, type: 'completed', course: (courseById(e.courseId) || {}).title });
    }
    for (const c of state.certificates.filter((c) => c.learnerId === lid)) events.push({ date: c.issuedAt, type: 'certified', course: (courseById(c.courseId) || {}).title });
    for (const e of state.examSchedules.filter((e) => e.learnerId === lid)) events.push({ date: e.scheduledFor, type: 'exam', course: (courseById(e.courseId) || {}).title });
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json({ events });
  }));
  app.get('/api/courses/:id/player', h(async (req, res) => {
    const s = await requireAuth(req, res); if (!s) return;
    const state = await repo.snapshot();
    const { courseById, progressFor } = helpers(state);
    const c = courseById(req.params.id);
    if (!c) return res.status(404).json({ error: 'not_found' });
    const lid = s.learnerId || s.id;
    res.json({
      id: c.id, title: c.title, summary: c.summary,
      lessons: c.lessons.map((l) => ({ id: l.id, title: l.title, type: l.type, durationMin: l.durationMin, url: l.url, downloadable: l.downloadable, body: l.body })),
      quiz: c.quiz.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
      test: { id: c.test.id, title: c.test.title, passScore: c.test.passScore, questionCount: c.test.questions.length },
      progress: progressFor(lid, c.id),
    });
  }));

  // ======================= Learner dashboard (persona-scoped) =======================
  const buildLearnerDashboard = (state, id) => {
    const { courseById, courseCard, providerName, domainName, learnerName, courseRating, progressFor } = helpers(state);
    const myEnr = state.enrollments.filter((e) => e.learnerId === id);
    const completed = myEnr.filter((e) => e.completed).map((e) => ({ ...courseCard(courseById(e.courseId)), completedAt: e.completedAt }));
    const inProgress = myEnr.filter((e) => !e.completed).map((e) => ({ ...courseCard(courseById(e.courseId)), ...progressFor(id, e.courseId), startedAt: e.startedAt }));
    const certs = state.certificates.filter((c) => c.learnerId === id).map((c) => ({ id: c.id, course: (courseById(c.courseId) || {}).title, courseId: c.courseId, provider: providerName((courseById(c.courseId) || {}).providerId), issuedAt: c.issuedAt, score: c.score }));
    const exams = state.examSchedules.filter((e) => e.learnerId === id).map((e) => ({ id: e.id, course: (courseById(e.courseId) || {}).title, courseId: e.courseId, scheduledFor: e.scheduledFor }));
    const calendar = [];
    for (const e of myEnr) {
      calendar.push({ date: e.startedAt, type: 'started', course: (courseById(e.courseId) || {}).title });
      if (e.completedAt) calendar.push({ date: e.completedAt, type: 'completed', course: (courseById(e.courseId) || {}).title });
    }
    for (const c of state.certificates.filter((c) => c.learnerId === id)) calendar.push({ date: c.issuedAt, type: 'certified', course: (courseById(c.courseId) || {}).title });
    for (const e of state.examSchedules.filter((e) => e.learnerId === id)) calendar.push({ date: e.scheduledFor, type: 'exam', course: (courseById(e.courseId) || {}).title });
    calendar.sort((a, b) => new Date(a.date) - new Date(b.date));
    return {
      learner: { id, name: learnerName(id) },
      stats: { completed: completed.length, inProgress: inProgress.length, certificates: certs.length, wishlist: state.wishlist.filter((w) => w.learnerId === id).length },
      completed, inProgress, certificates: certs, exams, calendar,
      roadmap: buildRoadmap({ db: state, learnerId: id, courseById, domainName, courseRating }),
    };
  };
  app.get('/api/learners/:id/dashboard', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json(buildLearnerDashboard(state, req.params.id));
  }));

  // ======================= Provider dashboard =======================
  const buildProviderDashboard = (state, pid) => {
    const { courseById, courseCard, providerName, domainName, learnerName, courseRating } = helpers(state);
    const myCourses = state.courses.filter((c) => c.providerId === pid);
    const courseStats = myCourses.map((c) => {
      const enr = state.enrollments.filter((e) => e.courseId === c.id);
      const completers = enr.filter((e) => e.completed).length;
      const tests = state.testResults.filter((t) => t.courseId === c.id);
      const r = courseRating(c.id);
      return {
        id: c.id, title: c.title, domain: domainName(c.domainId),
        wishlisted: state.wishlist.filter((w) => w.courseId === c.id).length,
        enrolled: enr.length, active: enr.length - completers, completed: completers,
        certificates: state.certificates.filter((ce) => ce.courseId === c.id).length,
        testsTaken: tests.length, testsPassed: tests.filter((t) => t.passed).length,
        rating: r.avg, ratingCount: r.count,
      };
    });
    const threads = state.feedback
      .filter((f) => myCourses.find((c) => c.id === f.courseId))
      .map((f) => ({
        id: f.id, courseId: f.courseId, course: (courseById(f.courseId) || {}).title,
        learner: learnerName(f.learnerId), score: f.score, comment: f.comment, createdAt: f.createdAt,
        replies: f.replies.map((rp) => ({ provider: providerName(rp.providerId), body: rp.body, createdAt: rp.createdAt })),
        needsReply: f.replies.length === 0,
      }))
      .sort((a, b) => Number(b.needsReply) - Number(a.needsReply));
    return {
      provider: { id: pid, name: providerName(pid) },
      totals: {
        courses: myCourses.length,
        wishlisted: courseStats.reduce((s, c) => s + c.wishlisted, 0),
        active: courseStats.reduce((s, c) => s + c.active, 0),
        completed: courseStats.reduce((s, c) => s + c.completed, 0),
        certificates: courseStats.reduce((s, c) => s + c.certificates, 0),
        awaitingReply: threads.filter((t) => t.needsReply).length,
      },
      courses: courseStats, threads,
    };
  };
  app.get('/api/providers/:id/dashboard', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json(buildProviderDashboard(state, req.params.id));
  }));
  app.get('/api/provider/overview', h(async (req, res) => {
    const s = await requireRole(req, res, 'provider'); if (!s) return;
    const state = await repo.snapshot();
    res.json(buildProviderDashboard(state, s.providerId || 'forge-labs'));
  }));

  // ======================= Owner dashboard / overview =======================
  const buildOwnerOverview = (state) => {
    const { courseById, courseCard, domainName } = helpers(state);
    const totalEnr = state.enrollments.length;
    const totalCompleted = state.enrollments.filter((e) => e.completed).length;
    const tests = state.testResults;
    const passed = tests.filter((t) => t.passed).length;
    const allFb = state.feedback;
    const avgScore = allFb.length ? Math.round((allFb.reduce((s, f) => s + f.score, 0) / allFb.length) * 10) / 10 : null;
    const byDomain = state.domains.map((d) => ({
      domain: d.name,
      enrolments: state.enrollments.filter((e) => (courseById(e.courseId) || {}).domainId === d.id).length,
      completions: state.enrollments.filter((e) => e.completed && (courseById(e.courseId) || {}).domainId === d.id).length,
    }));
    return {
      kpis: {
        learners: state.learners.length, providers: state.providers.length, courses: state.courses.length,
        enrolments: totalEnr, completions: totalCompleted,
        completionRate: totalEnr ? Math.round((totalCompleted / totalEnr) * 100) : 0,
        certificates: state.certificates.length, testsInProgress: state.examSchedules.length,
        testsTaken: tests.length, testPassRate: tests.length ? Math.round((passed / tests.length) * 100) : 0,
        avgFeedbackScore: avgScore, feedbackCount: allFb.length,
      },
      byDomain,
      topCourses: state.courses.map(courseCard).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5),
    };
  };
  const monthlyTrend = (state) => {
    const { courseById } = helpers(state);
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en', { month: 'short' }), completions: 0, enrolments: 0 });
    }
    const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; };
    for (const e of state.enrollments) {
      const m = months.find((x) => x.key === monthKey(e.startedAt));
      if (m) m.enrolments++;
      if (e.completedAt) { const mc = months.find((x) => x.key === monthKey(e.completedAt)); if (mc) mc.completions++; }
    }
    return months;
  };
  app.get('/api/owner/dashboard', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json({ ...buildOwnerOverview(state), trend: monthlyTrend(state) });
  }));
  app.get('/api/owner/overview', h(async (req, res) => {
    const s = await requireRole(req, res, 'owner'); if (!s) return;
    const state = await repo.snapshot();
    res.json(buildOwnerOverview(state));
  }));

  // ======================= Governance: audit, export, erasure =======================
  app.get('/api/governance/audit', h(async (req, res) => {
    const state = await repo.snapshot();
    res.json(state.auditLog.slice(0, 100).map((a) => ({ id: a.id, action: a.action, meta: a.meta, at: a.at })));
  }));
  app.get('/api/admin/audit', h(async (req, res) => {
    const s = await requireRole(req, res, 'owner'); if (!s) return;
    const state = await repo.snapshot();
    res.json({ entries: state.auditLog.slice(0, 200) });
  }));

  app.get('/api/learners/:id/export', h(async (req, res) => {
    const id = req.params.id;
    const state = await repo.snapshot();
    const { learnerName } = helpers(state);
    await repo.audit('data.export', { learnerId: id });
    res.setHeader('Content-Disposition', `attachment; filename="${BRAND_SLUG}-${id}.json"`);
    res.json({
      learner: { id, name: learnerName(id) },
      enrollments: state.enrollments.filter((e) => e.learnerId === id),
      certificates: state.certificates.filter((c) => c.learnerId === id),
      testResults: state.testResults.filter((t) => t.learnerId === id),
      feedback: state.feedback.filter((f) => f.learnerId === id),
      wishlist: state.wishlist.filter((w) => w.learnerId === id),
      exportedAt: new Date().toISOString(),
    });
  }));

  const csvCell = (v) => {
    const str = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  app.get('/api/exports/owner.csv', h(async (req, res) => {
    const s = await requireRole(req, res, 'owner'); if (!s) return;
    const state = await repo.snapshot();
    const { kpis, byDomain } = buildOwnerOverview(state);
    const lines = ['metric,value'];
    for (const [k, v] of Object.entries(kpis)) lines.push(`${csvCell(k)},${csvCell(v)}`);
    lines.push('');
    lines.push('domain,enrolments,completions');
    for (const d of byDomain) lines.push(`${csvCell(d.domain)},${csvCell(d.enrolments)},${csvCell(d.completions)}`);
    await repo.audit('dashboard.export', { kind: 'owner.csv', by: s.email });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cognivo-owner-dashboard.csv"');
    res.send(lines.join('\n') + '\n');
  }));

  // ---- Static SPA ----
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  return { app, pool, repo };
}

// Start the server unless imported by tests.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  createApp()
    .then(({ app }) => {
      const port = process.env.PORT || 3000;
      const server = app.listen(port, '0.0.0.0', () => log.info({ msg: `${BRAND_NAME} listening`, url: `http://0.0.0.0:${port}`, profile: (process.env.APP_PROFILE || 'production') }));
      const shutdown = (sig) => { log.info({ msg: 'shutting down', signal: sig }); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((err) => { log.error({ msg: 'failed to start', error: err.message }); process.exit(1); });
}
