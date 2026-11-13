// Cognivo LMS — deterministic sample-data generator.
// Produces a stable catalogue (6 domains, 30+ courses, mixed formats) plus a
// broad history of enrolments, completions, certificates, test results and
// feedback so dashboards and charts have meaningful data. The generated data
// is loaded into Postgres by src/seed.js; nothing here talks to a database.

// ---- Deterministic PRNG so seed data is identical across runs ----
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Course catalogue — several domains, 30+ courses, mixed formats.
const DOMAINS = [
  { id: 'data-science', name: 'Data Science', icon: '📊' },
  { id: 'business', name: 'Business', icon: '💼' },
  { id: 'computer-science', name: 'Computer Science', icon: '💻' },
  { id: 'design', name: 'Design & UX', icon: '🎨' },
  { id: 'health', name: 'Health & Wellbeing', icon: '🩺' },
  { id: 'security', name: 'Cyber Security', icon: '🔐' },
];

const PROVIDERS = [
  { id: 'nova', name: 'Nova Academy', bio: 'Industry-led data & AI training.' },
  { id: 'meridian', name: 'Meridian Institute', bio: 'Business, design and leadership programmes.' },
  { id: 'forge-labs', name: 'Forge Labs', bio: 'Hands-on engineering and security courses.' },
];

// 32 courses. The first is "Intro to Data Literacy" (slug: intro-to-data-literacy),
// the headline course referenced by the acceptance suite.
const COURSE_SEEDS = [
  // Data Science
  { t: 'Intro to Data Literacy', d: 'data-science', p: 'nova', lvl: 'Beginner', fmt: 'Course', hrs: 6, s: 'Read charts, question numbers and reason with everyday data.' },
  { t: 'Foundations of Data Science', d: 'data-science', p: 'nova', lvl: 'Beginner', fmt: 'Course', hrs: 12, s: 'From spreadsheets to statistical thinking and first models.' },
  { t: 'Applied Machine Learning', d: 'data-science', p: 'nova', lvl: 'Intermediate', fmt: 'Professional Certificate', hrs: 28, s: 'Build, evaluate and ship supervised learning models.' },
  { t: 'Data Visualisation with Python', d: 'data-science', p: 'nova', lvl: 'Intermediate', fmt: 'Course', hrs: 14, s: 'Turn datasets into clear, honest and accessible visuals.' },
  { t: 'Deep Learning Specialisation', d: 'data-science', p: 'forge-labs', lvl: 'Advanced', fmt: 'Specialisation', hrs: 46, s: 'Neural networks, CNNs and transformers from the ground up.' },
  { t: 'SQL for Analysts', d: 'data-science', p: 'meridian', lvl: 'Beginner', fmt: 'Guided Project', hrs: 8, s: 'Query, join and aggregate real relational data with confidence.' },
  // Business
  { t: 'Product Management Essentials', d: 'business', p: 'meridian', lvl: 'Beginner', fmt: 'Course', hrs: 10, s: 'Discovery, roadmaps and stakeholder alignment.' },
  { t: 'Leading High-Performing Teams', d: 'business', p: 'meridian', lvl: 'Advanced', fmt: 'Specialisation', hrs: 18, s: 'Coaching, feedback culture and delegation at scale.' },
  { t: 'Financial Modelling Fundamentals', d: 'business', p: 'meridian', lvl: 'Intermediate', fmt: 'Course', hrs: 16, s: 'Build forecasts, budgets and valuation models in spreadsheets.' },
  { t: 'Agile Delivery Masterclass', d: 'business', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Masterclass', hrs: 9, s: 'Flow, estimation and continuous delivery that actually ships.' },
  { t: 'Digital Marketing Strategy', d: 'business', p: 'meridian', lvl: 'Beginner', fmt: 'Course', hrs: 11, s: 'Positioning, channels and measurable growth loops.' },
  { t: 'Negotiation & Influence', d: 'business', p: 'meridian', lvl: 'Intermediate', fmt: 'Course', hrs: 7, s: 'Principled negotiation and persuasion for everyday work.' },
  // Computer Science
  { t: 'Full-Stack Web Development', d: 'computer-science', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Professional Certificate', hrs: 40, s: 'HTTP, databases, APIs and accessible front-ends.' },
  { t: 'Algorithms & Data Structures', d: 'computer-science', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Course', hrs: 22, s: 'Complexity, trees, graphs and interview-ready problem solving.' },
  { t: 'Cloud Engineering Foundations', d: 'computer-science', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Professional Certificate', hrs: 30, s: 'Containers, networking and infrastructure as code.' },
  { t: 'Programming with Python', d: 'computer-science', p: 'nova', lvl: 'Beginner', fmt: 'Course', hrs: 15, s: 'Variables to functions to a first real program.' },
  { t: 'Databases & Data Modelling', d: 'computer-science', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Course', hrs: 18, s: 'Relational design, normalisation and query performance.' },
  { t: 'Distributed Systems', d: 'computer-science', p: 'forge-labs', lvl: 'Advanced', fmt: 'Specialisation', hrs: 34, s: 'Consistency, replication and fault tolerance at scale.' },
  // Design & UX
  { t: 'UX Research & Usability Testing', d: 'design', p: 'meridian', lvl: 'Beginner', fmt: 'Course', hrs: 9, s: 'Plan studies, run sessions and turn insight into design.' },
  { t: 'Accessible Interface Design', d: 'design', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Course', hrs: 11, s: 'WCAG, inclusive patterns and assistive technology.' },
  { t: 'Design Systems in Practice', d: 'design', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Course', hrs: 13, s: 'Tokens, components and documentation that scale a brand.' },
  { t: 'Visual Design Principles', d: 'design', p: 'meridian', lvl: 'Beginner', fmt: 'Course', hrs: 8, s: 'Layout, typography, colour and hierarchy that communicate.' },
  { t: 'Interaction & Motion Design', d: 'design', p: 'meridian', lvl: 'Advanced', fmt: 'Masterclass', hrs: 12, s: 'Purposeful micro-interactions and accessible motion.' },
  // Health & Wellbeing
  { t: 'Workplace Wellbeing & Resilience', d: 'health', p: 'meridian', lvl: 'Beginner', fmt: 'Course', hrs: 6, s: 'Evidence-based habits for focus and sustainable performance.' },
  { t: 'Nutrition for Everyday Life', d: 'health', p: 'nova', lvl: 'Beginner', fmt: 'Course', hrs: 7, s: 'Cut through fads with practical, evidence-based nutrition.' },
  { t: 'Mindfulness at Work', d: 'health', p: 'meridian', lvl: 'Beginner', fmt: 'Guided Project', hrs: 5, s: 'Attention training for calmer, more effective workdays.' },
  { t: 'Sleep Science & Performance', d: 'health', p: 'nova', lvl: 'Intermediate', fmt: 'Course', hrs: 6, s: 'How sleep shapes health, mood and cognition — and how to improve it.' },
  // Cyber Security
  { t: 'Secure Software Development', d: 'security', p: 'forge-labs', lvl: 'Advanced', fmt: 'Professional Certificate', hrs: 26, s: 'Threat modelling, OWASP Top 10 and secure-by-design.' },
  { t: 'Cyber Security Fundamentals', d: 'security', p: 'forge-labs', lvl: 'Beginner', fmt: 'Course', hrs: 10, s: 'Threats, controls and the vocabulary of modern security.' },
  { t: 'Network Defence & Monitoring', d: 'security', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Course', hrs: 17, s: 'Detect, triage and respond to attacks on real networks.' },
  { t: 'Applied Cryptography', d: 'security', p: 'nova', lvl: 'Advanced', fmt: 'Course', hrs: 20, s: 'Hashes, signatures and protocols used correctly.' },
  { t: 'Cloud Security Essentials', d: 'security', p: 'forge-labs', lvl: 'Intermediate', fmt: 'Course', hrs: 15, s: 'Identity, least privilege and hardening cloud workloads.' },
];

const LESSON_VIDEO_TITLES = ['Overview', 'Core concepts', 'Techniques', 'Case study', 'Deep dive', 'Wrap-up'];
const LESSON_READ_TITLES = ['Primer', 'Reference guide', 'Worked examples', 'Checklist', 'Further study'];
// Public-domain sample clip (CC0) used for every video lesson in the demo.
const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const FEEDBACK_COMMENTS = [
  'Really practical and well paced — the worked examples made it click.',
  'Great content, though I would love more exercises in the later modules.',
  'The instructor explains tricky ideas clearly. Highly recommend.',
  'Solid overview. A few videos could be shorter.',
  'Exactly what I needed to move into this field.',
  'Good, but some reading material felt dated.',
  'The quizzes were a fair check on understanding.',
  'Loved the accessibility focus throughout.',
];

const LEARNER_NAMES = [
  'Jordan Rivera', 'Priya Natarajan', 'Sam Okafor', 'Lena Vogel', 'Diego Marchetti',
  'Aisha Khan', 'Tom Becker', 'Mei Lin', 'Carlos Mendez', 'Freya Nilsson',
  'Omar Haddad', 'Grace Park', 'Noah Williams', 'Sofia Rossi', 'Ivan Petrov',
  'Chloe Dubois', 'Kenji Tanaka', 'Amara Nwosu', 'Lucas Silva', 'Hannah Schmidt',
  'Yusuf Demir', 'Elena Popova', 'Liam Murphy', 'Nadia Haroon', 'Ravi Kapoor',
  'Zoe Anderson', 'Mateo Garcia', 'Ingrid Larsen', 'Farah Aziz', 'Daniel Cohen',
  'Olivia Brown', 'Hassan Ali', 'Yuki Sato', 'Marta Nowak', 'Bruno Costa',
  'Leila Mansour', 'Victor Hugo', 'Anya Sharma', 'Pedro Alves', 'Keiko Yamada',
];

export function generateSeed() {
  const rnd = mulberry32(20261113);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const range = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let seq = 1000;
  const uid = (p) => `${p}_${seq++}`;
  const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

  const domains = DOMAINS.map((d, i) => ({ ...d, sortOrder: i }));
  const providers = PROVIDERS.map((p) => ({ ...p }));

  const usedSlugs = new Set();
  const courses = COURSE_SEEDS.map((c) => {
    let id = slugify(c.t);
    while (usedSlugs.has(id)) id = `${id}-x`;
    usedSlugs.add(id);
    const lessonCount = range(4, 6);
    const lessons = [];
    for (let l = 0; l < lessonCount; l++) {
      const isVideo = l % 2 === 0;
      lessons.push({
        id: `${id}-l${l + 1}`,
        idx: l,
        title: isVideo
          ? `Module ${l + 1}: ${LESSON_VIDEO_TITLES[l % LESSON_VIDEO_TITLES.length]}`
          : `Reading ${l + 1}: ${LESSON_READ_TITLES[l % LESSON_READ_TITLES.length]}`,
        type: isVideo ? 'video' : 'reading',
        durationMin: isVideo ? range(8, 16) : range(5, 12),
        url: isVideo ? SAMPLE_VIDEO : null,
        downloadable: !isVideo,
        body: isVideo
          ? 'Watch the recorded session. Captions and a transcript are provided for accessibility.'
          : `Key points for ${c.t}. This reading is available to view online or download as a text file for offline study.`,
      });
    }
    const quiz = [
      { id: `${id}-q1`, prompt: `Which best describes the main goal of "${c.t}"?`, options: ['Memorising definitions', 'Applying concepts to real problems', 'Avoiding practice', 'Skipping fundamentals'], answer: 1 },
      { id: `${id}-q2`, prompt: 'What is the recommended way to retain new skills?', options: ['Cramming once', 'Spaced, hands-on practice', 'Only reading', 'Watching at 3x speed'], answer: 1 },
    ];
    const test = {
      id: `${id}-test`,
      title: `${c.t} — Certification Test`,
      passScore: 70,
      questions: [
        { id: `${id}-t1`, prompt: `A stakeholder asks you to justify a decision from "${c.t}". The strongest response is to:`, options: ['Guess', 'Cite evidence and trade-offs covered in the course', 'Defer entirely', 'Ignore the request'], answer: 1 },
        { id: `${id}-t2`, prompt: 'Which practice most improves the quality of your work?', options: ['Skipping review', 'Iterating with feedback', 'Working in isolation', 'Avoiding tests'], answer: 1 },
        { id: `${id}-t3`, prompt: 'The best measure of mastery is:', options: ['Time spent', 'Demonstrated outcomes', 'Number of tabs open', 'Confidence alone'], answer: 1 },
      ],
    };
    return {
      id, title: c.t, summary: c.s, level: c.lvl, format: c.fmt, durationHrs: c.hrs,
      domainId: c.d, providerId: c.p, lessons, quiz, test,
    };
  });

  const courseById = (id) => courses.find((c) => c.id === id);
  const learners = LEARNER_NAMES.map((name, i) => ({ id: `learner-${i + 1}`, name }));

  const enrollments = [];
  const certificates = [];
  const testResults = [];
  const feedback = [];
  const wishlist = [];
  const examSchedules = [];

  // Broad history across learners/courses for charts.
  for (const learner of learners) {
    const n = range(3, 8);
    const chosen = new Set();
    for (let k = 0; k < n; k++) {
      const course = pick(courses);
      if (chosen.has(course.id)) continue;
      chosen.add(course.id);
      const started = range(10, 330);
      const completed = rnd() > 0.35;
      const completedLessonIds = completed
        ? course.lessons.map((l) => l.id)
        : course.lessons.slice(0, range(1, Math.max(1, course.lessons.length - 1))).map((l) => l.id);
      const completedAt = completed ? daysAgo(Math.max(1, started - range(2, 9))) : null;
      enrollments.push({
        id: uid('enr'), learnerId: learner.id, courseId: course.id,
        startedAt: daysAgo(started), completedLessonIds, completed, completedAt,
      });
      if (completed) {
        if (rnd() > 0.25) {
          feedback.push({
            id: uid('fb'), courseId: course.id, learnerId: learner.id,
            score: range(3, 5), comment: pick(FEEDBACK_COMMENTS), createdAt: completedAt, replies: [],
          });
        }
        if (rnd() > 0.3) {
          const score = range(55, 100);
          const passed = score >= course.test.passScore;
          const takenAt = daysAgo(Math.max(1, started - range(1, 5)));
          testResults.push({ id: uid('tr'), learnerId: learner.id, courseId: course.id, score, passed, takenAt });
          if (passed) certificates.push({ id: uid('cert'), learnerId: learner.id, courseId: course.id, issuedAt: takenAt, score });
        }
      }
      if (rnd() > 0.7) {
        wishlist.push({ learnerId: learner.id, courseId: pick(courses).id, addedAt: daysAgo(range(1, 40)) });
      }
    }
  }

  // De-duplicate wishlist (learner+course unique).
  const wlSeen = new Set();
  const wishlistUnique = wishlist.filter((w) => {
    const key = `${w.learnerId}|${w.courseId}`;
    if (wlSeen.has(key)) return false;
    wlSeen.add(key);
    return true;
  });

  // Seed provider replies on a few feedback items so threads exist.
  for (const fb of feedback.slice(0, 8)) {
    const course = courseById(fb.courseId);
    fb.replies.push({
      id: uid('rep'), providerId: course.providerId,
      body: 'Thank you for the thoughtful feedback — we have noted your suggestion for the next cohort.',
      createdAt: new Date(new Date(fb.createdAt).getTime() + 2 * 86400000).toISOString(),
    });
  }

  // Give the demo learner (learner-1) a rich, predictable profile.
  const demo = learners[0];
  const demoId = demo.id;
  const upsertEnrollment = (courseId, completed) => {
    let e = enrollments.find((x) => x.learnerId === demoId && x.courseId === courseId);
    const course = courseById(courseId);
    if (!e) {
      e = { id: uid('enr'), learnerId: demoId, courseId, startedAt: daysAgo(40), completedLessonIds: [], completed: false, completedAt: null };
      enrollments.push(e);
    }
    if (completed) {
      e.completed = true;
      e.completedLessonIds = course.lessons.map((l) => l.id);
      e.completedAt = e.completedAt || daysAgo(12);
    }
    return e;
  };
  upsertEnrollment('intro-to-data-literacy', true);
  upsertEnrollment('product-management-essentials', true);
  const inProg = upsertEnrollment('full-stack-web-development', false);
  inProg.completedLessonIds = courseById('full-stack-web-development').lessons.slice(0, 2).map((l) => l.id);

  const addWish = (courseId, d) => {
    if (!wishlistUnique.find((w) => w.learnerId === demoId && w.courseId === courseId)) {
      wishlistUnique.push({ learnerId: demoId, courseId, addedAt: daysAgo(d) });
    }
  };
  addWish('applied-machine-learning', 5);
  addWish('secure-software-development', 3);

  if (!certificates.find((c) => c.learnerId === demoId && c.courseId === 'intro-to-data-literacy')) {
    certificates.push({ id: uid('cert'), learnerId: demoId, courseId: 'intro-to-data-literacy', issuedAt: daysAgo(10), score: 88 });
    testResults.push({ id: uid('tr'), learnerId: demoId, courseId: 'intro-to-data-literacy', score: 88, passed: true, takenAt: daysAgo(10) });
  }
  examSchedules.push({ id: uid('exam'), learnerId: demoId, courseId: 'product-management-essentials', scheduledFor: daysAgo(-6) });

  // Demo accounts (one per non-anonymous persona). Passwords are set to
  // SEED_PASSWORD by the seeder; the learner account maps to the demo learner,
  // the provider account to Forge Labs.
  const accounts = [
    { id: 'owner-1', email: 'owner@nigeria-demo.cognivo', role: 'owner', name: 'Platform Owner', providerId: null, learnerId: null },
    { id: 'provider-forge-labs', email: 'provider@nigeria-demo.cognivo', role: 'provider', name: 'Forge Labs', providerId: 'forge-labs', learnerId: null },
    { id: demoId, email: 'learner@nigeria-demo.cognivo', role: 'learner', name: demo.name, providerId: null, learnerId: demoId },
  ];

  return {
    domains, providers, courses, learners, accounts,
    enrollments, certificates, testResults, feedback,
    wishlist: wishlistUnique, examSchedules,
    demoLearnerId: demoId,
    demoProviderId: 'forge-labs',
  };
}
