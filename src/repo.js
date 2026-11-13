// Repository layer. All database access goes through here with parameterised
// queries. `snapshot()` loads the current state into the plain-object shape the
// route handlers and aggregation logic use; the mutation methods write through
// to Postgres. Demo-scale data makes a per-request snapshot cheap and keeps the
// aggregation code simple and auditable (see ARCHITECTURE.md §2).

import crypto from 'node:crypto';

const toISO = (v) => (v instanceof Date ? v.toISOString() : v == null ? v : String(v));
const uid = (p) => `${p}_${crypto.randomBytes(9).toString('hex')}`;

export function createRepo(pool) {
  async function snapshot() {
    const [
      domainsR, providersR, coursesR, lessonsR, quizR, testQR,
      learnersR, enrollR, compLessonsR, certsR, testResR, fbR, repliesR, wishR, examR, auditR,
    ] = await Promise.all([
      pool.query('SELECT id,name,icon,sort_order FROM domains ORDER BY sort_order, name'),
      pool.query('SELECT id,name,bio FROM providers ORDER BY name'),
      pool.query('SELECT id,title,summary,level,format,duration_hrs,domain_id,provider_id,test_id,test_title,pass_score FROM courses ORDER BY title'),
      pool.query('SELECT id,course_id,idx,title,type,duration_min,url,downloadable,body FROM lessons ORDER BY course_id, idx'),
      pool.query('SELECT id,course_id,idx,prompt,options,answer FROM quiz_questions ORDER BY course_id, idx'),
      pool.query('SELECT id,course_id,idx,prompt,options,answer FROM test_questions ORDER BY course_id, idx'),
      pool.query('SELECT id,name FROM learners ORDER BY name'),
      pool.query('SELECT id,learner_id,course_id,started_at,completed,completed_at FROM enrollments'),
      pool.query('SELECT enrollment_id,lesson_id FROM completed_lessons'),
      pool.query('SELECT id,learner_id,course_id,issued_at,score FROM certificates'),
      pool.query('SELECT id,learner_id,course_id,score,passed,taken_at FROM test_results'),
      pool.query('SELECT id,course_id,learner_id,score,comment,created_at FROM feedback'),
      pool.query('SELECT id,feedback_id,provider_id,body,created_at FROM feedback_replies ORDER BY created_at'),
      pool.query('SELECT learner_id,course_id,added_at FROM wishlist'),
      pool.query('SELECT id,learner_id,course_id,scheduled_for FROM exam_schedules'),
      pool.query('SELECT id,action,meta,at FROM audit_log ORDER BY id DESC LIMIT 500'),
    ]);

    const parseOpts = (o) => (typeof o === 'string' ? JSON.parse(o) : o);

    const lessonsByCourse = new Map();
    for (const l of lessonsR.rows) {
      const arr = lessonsByCourse.get(l.course_id) || [];
      arr.push({ id: l.id, idx: l.idx, title: l.title, type: l.type, durationMin: l.duration_min, url: l.url, downloadable: l.downloadable, body: l.body });
      lessonsByCourse.set(l.course_id, arr);
    }
    const quizByCourse = new Map();
    for (const q of quizR.rows) {
      const arr = quizByCourse.get(q.course_id) || [];
      arr.push({ id: q.id, prompt: q.prompt, options: parseOpts(q.options), answer: q.answer });
      quizByCourse.set(q.course_id, arr);
    }
    const testQByCourse = new Map();
    for (const q of testQR.rows) {
      const arr = testQByCourse.get(q.course_id) || [];
      arr.push({ id: q.id, prompt: q.prompt, options: parseOpts(q.options), answer: q.answer });
      testQByCourse.set(q.course_id, arr);
    }

    const courses = coursesR.rows.map((c) => ({
      id: c.id, title: c.title, summary: c.summary, level: c.level, format: c.format,
      durationHrs: c.duration_hrs, domainId: c.domain_id, providerId: c.provider_id,
      lessons: lessonsByCourse.get(c.id) || [],
      quiz: quizByCourse.get(c.id) || [],
      test: { id: c.test_id, title: c.test_title, passScore: c.pass_score, questions: testQByCourse.get(c.id) || [] },
    }));

    const compByEnr = new Map();
    for (const r of compLessonsR.rows) {
      const arr = compByEnr.get(r.enrollment_id) || [];
      arr.push(r.lesson_id);
      compByEnr.set(r.enrollment_id, arr);
    }
    const enrollments = enrollR.rows.map((e) => ({
      id: e.id, learnerId: e.learner_id, courseId: e.course_id,
      startedAt: toISO(e.started_at), completed: e.completed, completedAt: toISO(e.completed_at),
      completedLessonIds: compByEnr.get(e.id) || [],
    }));

    const repliesByFb = new Map();
    for (const r of repliesR.rows) {
      const arr = repliesByFb.get(r.feedback_id) || [];
      arr.push({ id: r.id, providerId: r.provider_id, body: r.body, createdAt: toISO(r.created_at) });
      repliesByFb.set(r.feedback_id, arr);
    }
    const feedback = fbR.rows.map((f) => ({
      id: f.id, courseId: f.course_id, learnerId: f.learner_id, score: f.score,
      comment: f.comment, createdAt: toISO(f.created_at), replies: repliesByFb.get(f.id) || [],
    }));

    return {
      domains: domainsR.rows.map((d) => ({ id: d.id, name: d.name, icon: d.icon })),
      providers: providersR.rows.map((p) => ({ id: p.id, name: p.name, bio: p.bio })),
      courses,
      learners: learnersR.rows.map((l) => ({ id: l.id, name: l.name })),
      enrollments,
      certificates: certsR.rows.map((c) => ({ id: c.id, learnerId: c.learner_id, courseId: c.course_id, issuedAt: toISO(c.issued_at), score: c.score })),
      testResults: testResR.rows.map((t) => ({ id: t.id, learnerId: t.learner_id, courseId: t.course_id, score: t.score, passed: t.passed, takenAt: toISO(t.taken_at) })),
      feedback,
      wishlist: wishR.rows.map((w) => ({ learnerId: w.learner_id, courseId: w.course_id, addedAt: toISO(w.added_at) })),
      examSchedules: examR.rows.map((x) => ({ id: x.id, learnerId: x.learner_id, courseId: x.course_id, scheduledFor: toISO(x.scheduled_for) })),
      auditLog: auditR.rows.map((a) => ({ id: Number(a.id), action: a.action, meta: typeof a.meta === 'string' ? JSON.parse(a.meta) : a.meta, at: toISO(a.at) })),
    };
  }

  async function audit(action, meta = {}) {
    await pool.query('INSERT INTO audit_log(action, meta) VALUES ($1,$2)', [action, JSON.stringify(meta)]);
  }

  // Marks a lesson complete, creating the enrollment on first touch. Flips the
  // enrollment to completed (in a transaction) once every lesson is done.
  async function completeLesson(learnerId, courseId, lessonId, totalLessons) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let r = await client.query('SELECT id, completed FROM enrollments WHERE learner_id=$1 AND course_id=$2', [learnerId, courseId]);
      let enrollmentId;
      if (r.rows.length === 0) {
        enrollmentId = uid('enr');
        await client.query('INSERT INTO enrollments(id,learner_id,course_id,started_at,completed) VALUES ($1,$2,$3,now(),false)', [enrollmentId, learnerId, courseId]);
      } else {
        enrollmentId = r.rows[0].id;
      }
      await client.query('INSERT INTO completed_lessons(enrollment_id,lesson_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [enrollmentId, lessonId]);
      const cnt = await client.query('SELECT COUNT(*)::int AS n FROM completed_lessons WHERE enrollment_id=$1', [enrollmentId]);
      const done = Number(cnt.rows[0].n);
      let justCompleted = false;
      if (done >= totalLessons) {
        const upd = await client.query('UPDATE enrollments SET completed=true, completed_at=now() WHERE id=$1 AND completed=false', [enrollmentId]);
        justCompleted = upd.rowCount > 0;
      }
      await client.query('COMMIT');
      return { justCompleted };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async function upsertFeedback(learnerId, courseId, score, comment) {
    const existing = await pool.query('SELECT id FROM feedback WHERE course_id=$1 AND learner_id=$2', [courseId, learnerId]);
    if (existing.rows.length) {
      await pool.query('UPDATE feedback SET score=$1, comment=$2, created_at=now() WHERE id=$3', [score, comment, existing.rows[0].id]);
      return { id: existing.rows[0].id, updated: true };
    }
    const id = uid('fb');
    await pool.query('INSERT INTO feedback(id,course_id,learner_id,score,comment) VALUES ($1,$2,$3,$4,$5)', [id, courseId, learnerId, score, comment]);
    return { id, updated: false };
  }

  async function getFeedbackWithCourse(feedbackId) {
    const r = await pool.query(
      `SELECT f.id, f.course_id, c.provider_id FROM feedback f JOIN courses c ON c.id = f.course_id WHERE f.id=$1`,
      [feedbackId]
    );
    return r.rows[0] || null;
  }

  async function addReply(feedbackId, providerId, body) {
    const id = uid('rep');
    await pool.query('INSERT INTO feedback_replies(id,feedback_id,provider_id,body) VALUES ($1,$2,$3,$4)', [id, feedbackId, providerId, body]);
    return { id };
  }

  async function recordTest(learnerId, courseId, score, passed) {
    const trId = uid('tr');
    await pool.query('INSERT INTO test_results(id,learner_id,course_id,score,passed) VALUES ($1,$2,$3,$4,$5)', [trId, learnerId, courseId, score, passed]);
    if (!passed) return { certificate: null };
    const certId = uid('cert');
    await pool.query('INSERT INTO certificates(id,learner_id,course_id,score) VALUES ($1,$2,$3,$4)', [certId, learnerId, courseId, score]);
    const row = await pool.query('SELECT issued_at FROM certificates WHERE id=$1', [certId]);
    return { certificate: { id: certId, learnerId, courseId, issuedAt: toISO(row.rows[0].issued_at), score } };
  }

  async function addWishlist(learnerId, courseId) {
    await pool.query('INSERT INTO wishlist(learner_id,course_id) VALUES ($1,$2) ON CONFLICT (learner_id,course_id) DO NOTHING', [learnerId, courseId]);
  }
  async function removeWishlist(learnerId, courseId) {
    const r = await pool.query('DELETE FROM wishlist WHERE learner_id=$1 AND course_id=$2', [learnerId, courseId]);
    return { removed: r.rowCount > 0 };
  }

  async function courseExists(courseId) {
    const r = await pool.query('SELECT 1 FROM courses WHERE id=$1', [courseId]);
    return r.rows.length > 0;
  }

  // ---- Auth / sessions ----
  async function findAccountByEmail(email) {
    const r = await pool.query('SELECT id,email,role,name,provider_id,learner_id,password_hash FROM accounts WHERE email=$1', [email]);
    const a = r.rows[0];
    if (!a) return null;
    return { id: a.id, email: a.email, role: a.role, name: a.name, providerId: a.provider_id, learnerId: a.learner_id, passwordHash: a.password_hash };
  }
  async function listDemoAccounts() {
    const r = await pool.query("SELECT id,email,role,name,provider_id,learner_id FROM accounts ORDER BY role");
    return r.rows.map((a) => ({ id: a.id, email: a.email, role: a.role, name: a.name, providerId: a.provider_id, learnerId: a.learner_id }));
  }
  async function createSession(account, ttlMs) {
    const token = crypto.randomBytes(24).toString('hex');
    const data = { id: account.id, email: account.email, role: account.role, name: account.name, providerId: account.providerId, learnerId: account.learnerId };
    const expires = new Date(Date.now() + ttlMs).toISOString();
    await pool.query('INSERT INTO sessions(token,account_id,data,expires_at) VALUES ($1,$2,$3,$4)', [token, account.id, JSON.stringify(data), expires]);
    return { token, data };
  }
  async function getSession(token) {
    if (!token) return null;
    const r = await pool.query('SELECT data, expires_at FROM sessions WHERE token=$1', [token]);
    const row = r.rows[0];
    if (!row) return null;
    if (new Date(toISO(row.expires_at)).getTime() < Date.now()) {
      await pool.query('DELETE FROM sessions WHERE token=$1', [token]).catch(() => {});
      return null;
    }
    return typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  }
  async function deleteSession(token) {
    if (token) await pool.query('DELETE FROM sessions WHERE token=$1', [token]);
  }

  async function ping() {
    await pool.query('SELECT 1');
    return true;
  }

  return {
    snapshot, audit, completeLesson, upsertFeedback, getFeedbackWithCourse, addReply,
    recordTest, addWishlist, removeWishlist, courseExists,
    findAccountByEmail, listDemoAccounts, createSession, getSession, deleteSession, ping,
  };
}
