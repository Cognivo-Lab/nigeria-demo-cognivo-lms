// Seeds the database from the deterministic generator (src/data.js).
// Idempotent: if courses already exist it does nothing. In the demo profile the
// seeder runs on boot; in production the database starts empty and first-run
// setup creates the owner instead.

import { generateSeed } from './data.js';
import { hashPassword } from './password.js';

export async function isSeeded(pool) {
  const r = await pool.query('SELECT COUNT(*)::int AS n FROM courses');
  return Number(r.rows[0].n) > 0;
}

export async function seed(pool, { seedPassword, log = console } = {}) {
  if (await isSeeded(pool)) return { seeded: false };

  const data = generateSeed();
  const pw = hashPassword(seedPassword || 'change-me');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const d of data.domains) {
      await client.query(
        'INSERT INTO domains(id, name, icon, sort_order) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
        [d.id, d.name, d.icon, d.sortOrder]
      );
    }
    for (const p of data.providers) {
      await client.query(
        'INSERT INTO providers(id, name, bio) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING',
        [p.id, p.name, p.bio]
      );
    }
    for (const c of data.courses) {
      await client.query(
        `INSERT INTO courses(id,title,summary,level,format,duration_hrs,domain_id,provider_id,test_id,test_title,pass_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.title, c.summary, c.level, c.format, c.durationHrs, c.domainId, c.providerId, c.test.id, c.test.title, c.test.passScore]
      );
      for (const l of c.lessons) {
        await client.query(
          `INSERT INTO lessons(id,course_id,idx,title,type,duration_min,url,downloadable,body)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
          [l.id, c.id, l.idx, l.title, l.type, l.durationMin, l.url, l.downloadable, l.body]
        );
      }
      for (let i = 0; i < c.quiz.length; i++) {
        const q = c.quiz[i];
        await client.query(
          'INSERT INTO quiz_questions(id,course_id,idx,prompt,options,answer) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
          [q.id, c.id, i, q.prompt, JSON.stringify(q.options), q.answer]
        );
      }
      for (let i = 0; i < c.test.questions.length; i++) {
        const q = c.test.questions[i];
        await client.query(
          'INSERT INTO test_questions(id,course_id,idx,prompt,options,answer) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
          [q.id, c.id, i, q.prompt, JSON.stringify(q.options), q.answer]
        );
      }
    }
    for (const l of data.learners) {
      await client.query('INSERT INTO learners(id, name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING', [l.id, l.name]);
    }
    for (const a of data.accounts) {
      await client.query(
        'INSERT INTO accounts(id,email,role,name,provider_id,learner_id,password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
        [a.id, a.email, a.role, a.name, a.providerId, a.learnerId, pw]
      );
    }
    for (const e of data.enrollments) {
      await client.query(
        'INSERT INTO enrollments(id,learner_id,course_id,started_at,completed,completed_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (learner_id,course_id) DO NOTHING',
        [e.id, e.learnerId, e.courseId, e.startedAt, e.completed, e.completedAt]
      );
      for (const lid of e.completedLessonIds) {
        await client.query(
          'INSERT INTO completed_lessons(enrollment_id, lesson_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [e.id, lid]
        );
      }
    }
    for (const c of data.certificates) {
      await client.query(
        'INSERT INTO certificates(id,learner_id,course_id,issued_at,score) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
        [c.id, c.learnerId, c.courseId, c.issuedAt, c.score]
      );
    }
    for (const t of data.testResults) {
      await client.query(
        'INSERT INTO test_results(id,learner_id,course_id,score,passed,taken_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
        [t.id, t.learnerId, t.courseId, t.score, t.passed, t.takenAt]
      );
    }
    for (const f of data.feedback) {
      await client.query(
        'INSERT INTO feedback(id,course_id,learner_id,score,comment,created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (course_id,learner_id) DO NOTHING',
        [f.id, f.courseId, f.learnerId, f.score, f.comment, f.createdAt]
      );
      for (const r of f.replies) {
        await client.query(
          'INSERT INTO feedback_replies(id,feedback_id,provider_id,body,created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
          [r.id, f.id, r.providerId, r.body, r.createdAt]
        );
      }
    }
    for (const w of data.wishlist) {
      await client.query(
        'INSERT INTO wishlist(learner_id,course_id,added_at) VALUES ($1,$2,$3) ON CONFLICT (learner_id,course_id) DO NOTHING',
        [w.learnerId, w.courseId, w.addedAt]
      );
    }
    for (const x of data.examSchedules) {
      await client.query(
        'INSERT INTO exam_schedules(id,learner_id,course_id,scheduled_for) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
        [x.id, x.learnerId, x.courseId, x.scheduledFor]
      );
    }

    await client.query('COMMIT');
    log.info?.({ msg: 'demo data seeded', courses: data.courses.length, learners: data.learners.length });
    return { seeded: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Creates the first owner account for a production (empty) install from env.
export async function ensureOwner(pool, { email, password, name = 'Platform Owner', log = console } = {}) {
  const existing = await pool.query("SELECT COUNT(*)::int AS n FROM accounts WHERE role = 'owner'");
  if (Number(existing.rows[0].n) > 0) return { created: false };
  await pool.query(
    'INSERT INTO accounts(id,email,role,name,provider_id,learner_id,password_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    ['owner-1', email, 'owner', name, null, null, hashPassword(password)]
  );
  log.info?.({ msg: 'first-run owner account created', email });
  return { created: true };
}
