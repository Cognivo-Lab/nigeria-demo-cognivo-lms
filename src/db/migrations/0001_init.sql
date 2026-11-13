-- Cognivo LMS — initial schema.
-- All tenant/content data for a single white-label instance. Parameterised
-- queries only; see src/repo.js. Applied on boot by src/db/migrate.js.

CREATE TABLE IF NOT EXISTS domains (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  icon       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS providers (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS courses (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL DEFAULT '',
  level        TEXT NOT NULL DEFAULT 'Beginner',
  format       TEXT NOT NULL DEFAULT 'Course',
  duration_hrs INTEGER NOT NULL DEFAULT 0,
  domain_id    TEXT NOT NULL REFERENCES domains(id),
  provider_id  TEXT NOT NULL REFERENCES providers(id),
  test_id      TEXT NOT NULL DEFAULT '',
  test_title   TEXT NOT NULL DEFAULT '',
  pass_score   INTEGER NOT NULL DEFAULT 70
);

CREATE TABLE IF NOT EXISTS lessons (
  id           TEXT PRIMARY KEY,
  course_id    TEXT NOT NULL REFERENCES courses(id),
  idx          INTEGER NOT NULL,
  title        TEXT NOT NULL,
  type         TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 0,
  url          TEXT,
  downloadable BOOLEAN NOT NULL DEFAULT FALSE,
  body         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id        TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  idx       INTEGER NOT NULL,
  prompt    TEXT NOT NULL,
  options   JSONB NOT NULL,
  answer    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_questions (
  id        TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  idx       INTEGER NOT NULL,
  prompt    TEXT NOT NULL,
  options   JSONB NOT NULL,
  answer    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS learners (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL,
  name          TEXT NOT NULL,
  provider_id   TEXT,
  learner_id    TEXT,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id           TEXT PRIMARY KEY,
  learner_id   TEXT NOT NULL,
  course_id    TEXT NOT NULL REFERENCES courses(id),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  UNIQUE (learner_id, course_id)
);

CREATE TABLE IF NOT EXISTS completed_lessons (
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  lesson_id     TEXT NOT NULL,
  PRIMARY KEY (enrollment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id         TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  course_id  TEXT NOT NULL REFERENCES courses(id),
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  score      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS test_results (
  id         TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL,
  course_id  TEXT NOT NULL REFERENCES courses(id),
  score      INTEGER NOT NULL,
  passed     BOOLEAN NOT NULL,
  taken_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  course_id  TEXT NOT NULL REFERENCES courses(id),
  learner_id TEXT NOT NULL,
  score      INTEGER NOT NULL,
  comment    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, learner_id)
);

CREATE TABLE IF NOT EXISTS feedback_replies (
  id          TEXT PRIMARY KEY,
  feedback_id TEXT NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wishlist (
  learner_id TEXT NOT NULL,
  course_id  TEXT NOT NULL REFERENCES courses(id),
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_id, course_id)
);

CREATE TABLE IF NOT EXISTS exam_schedules (
  id            TEXT PRIMARY KEY,
  learner_id    TEXT NOT NULL,
  course_id     TEXT NOT NULL REFERENCES courses(id),
  scheduled_for TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id     BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  meta   JSONB NOT NULL DEFAULT '{}',
  at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS consents (
  id         TEXT PRIMARY KEY,
  subject    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  granted    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_domain ON courses(domain_id);
CREATE INDEX IF NOT EXISTS idx_courses_provider ON courses(provider_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_learner ON enrollments(learner_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_feedback_course ON feedback(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_learner ON certificates(learner_id);
CREATE INDEX IF NOT EXISTS idx_testresults_course ON test_results(course_id);
