// AI-built learning roadmap.
// Uses an LLM (Anthropic Claude) when ANTHROPIC_API_KEY is set; otherwise a
// deterministic rule-based generator that works offline (see SCOPE/deps).
// This module stays synchronous and rule-based for the demo path so the
// dashboard renders instantly with no external calls.

export function buildRoadmap({ db, learnerId, courseById, domainName, courseRating }) {
  const myEnr = db.enrollments.filter((e) => e.learnerId === learnerId);
  const completedCourseIds = new Set(myEnr.filter((e) => e.completed).map((e) => e.courseId));
  const inProgressIds = new Set(myEnr.filter((e) => !e.completed).map((e) => e.courseId));

  // Infer interest from domains the learner has engaged with + their wishlist.
  const interestDomains = new Map();
  for (const e of myEnr) {
    const d = courseById(e.courseId).domainId;
    interestDomains.set(d, (interestDomains.get(d) || 0) + (e.completed ? 2 : 1));
  }
  for (const w of db.wishlist.filter((w) => w.learnerId === learnerId)) {
    const d = courseById(w.courseId).domainId;
    interestDomains.set(d, (interestDomains.get(d) || 0) + 1);
  }
  const topDomain = [...interestDomains.entries()].sort((a, b) => b[1] - a[1])[0];
  const focus = topDomain ? topDomain[0] : 'data-science';

  const levelRank = { Beginner: 1, Intermediate: 2, Advanced: 3 };

  // Candidate next courses: not yet completed, in the focus domain or wishlisted,
  // ordered by level then rating.
  const wishlistIds = new Set(db.wishlist.filter((w) => w.learnerId === learnerId).map((w) => w.courseId));
  const candidates = db.courses
    .filter((c) => !completedCourseIds.has(c.id))
    .map((c) => {
      let priority = 0;
      if (inProgressIds.has(c.id)) priority += 5; // finish what you started
      if (wishlistIds.has(c.id)) priority += 3;
      if (c.domainId === focus) priority += 2;
      priority += (courseRating(c.id).avg || 3) * 0.3;
      return { c, priority };
    })
    .sort((a, b) => b.priority - a.priority || (levelRank[a.c.level] - levelRank[b.c.level]))
    .slice(0, 4);

  const steps = candidates.map(({ c }, i) => ({
    order: i + 1,
    courseId: c.id,
    title: c.title,
    level: c.level,
    domain: domainName(c.domainId),
    durationHrs: c.durationHrs,
    reason: inProgressIds.has(c.id)
      ? 'Resume and finish — you have already started this.'
      : wishlistIds.has(c.id)
      ? 'From your wishlist — a natural next step.'
      : `Builds on your interest in ${domainName(c.domainId)}.`,
  }));

  const totalHrs = steps.reduce((s, x) => s + x.durationHrs, 0);
  return {
    focusDomain: domainName(focus),
    summary: steps.length
      ? `Based on your ${completedCourseIds.size} completed course(s) and interest in ${domainName(focus)}, here is a ${steps.length}-step path (~${totalHrs}h).`
      : 'Start by exploring the catalogue to seed your personalised roadmap.',
    estimatedHours: totalHrs,
    steps,
  };
}
