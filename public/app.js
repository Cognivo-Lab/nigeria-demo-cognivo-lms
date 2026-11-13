// Forge LMS — SPA front-end (vanilla, no framework).
const main = document.getElementById('main');
const toastEl = document.getElementById('toast');

const state = {
  persona: 'guest',
  learnerId: null,
  providerId: null,
  meta: null,
  brand: { brandName: 'Cognivo LMS' },
};

// ---------- white-label branding ----------
function applyBrand(brand) {
  const name = (brand && brand.brandName) || 'Cognivo LMS';
  state.brand = brand || state.brand;
  document.title = `${name} — Learn. Certify. Grow.`;
  const bn = document.getElementById('brand-name');
  if (bn) bn.textContent = name;
  const fb = document.getElementById('footer-brand');
  if (fb) fb.textContent = name;
}

// ---------- utilities ----------
const api = async (path, opts) => {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  return { ok: res.ok, status: res.status, data };
};
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const stars = (n) => n == null ? '—' : '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

// ---------- theme ----------
const themeSel = document.getElementById('theme');
const savedTheme = localStorage.getItem('forge-theme') || 'system';
themeSel.value = savedTheme; document.documentElement.setAttribute('data-theme', savedTheme);
themeSel.addEventListener('change', () => {
  document.documentElement.setAttribute('data-theme', themeSel.value);
  localStorage.setItem('forge-theme', themeSel.value);
});

// ---------- charts (accessible inline SVG) ----------
const CHART_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];
function barChart(data, { title, width = 520, height = 180, color = 'var(--c1)' } = {}) {
  const pad = { l: 34, r: 10, t: 10, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (width - pad.l - pad.r) / data.length;
  const bars = data.map((d, i) => {
    const h = (d.value / max) * (height - pad.t - pad.b);
    const x = pad.l + i * bw + bw * 0.15;
    const y = height - pad.b - h;
    const c = Array.isArray(color) ? color[i % color.length] : color;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${c}"><title>${esc(d.label)}: ${d.value}</title></rect>
      <text x="${(x + bw * 0.35).toFixed(1)}" y="${height - pad.b + 14}" font-size="10" fill="var(--muted)" text-anchor="middle">${esc(d.label)}</text>
      <text x="${(x + bw * 0.35).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="10" fill="var(--muted)" text-anchor="middle">${d.value}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(title)}">
    <line x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}" stroke="var(--border)"/>${bars}</svg>`;
}
function lineChart(series, { title, width = 520, height = 180 } = {}) {
  const pad = { l: 34, r: 10, t: 12, b: 28 };
  const allVals = series.flatMap((s) => s.points.map((p) => p.value));
  const max = Math.max(1, ...allVals);
  const n = series[0].points.length;
  const xStep = (width - pad.l - pad.r) / Math.max(1, n - 1);
  const y = (v) => height - pad.b - (v / max) * (height - pad.t - pad.b);
  const lines = series.map((s, si) => {
    const pts = s.points.map((p, i) => `${(pad.l + i * xStep).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const dots = s.points.map((p, i) => `<circle cx="${(pad.l + i * xStep).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3" fill="${CHART_COLORS[si]}"><title>${esc(s.name)} ${esc(p.label)}: ${p.value}</title></circle>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="${CHART_COLORS[si]}" stroke-width="2.5"/>${dots}`;
  }).join('');
  const labels = series[0].points.map((p, i) => `<text x="${(pad.l + i * xStep).toFixed(1)}" y="${height - pad.b + 14}" font-size="10" fill="var(--muted)" text-anchor="middle">${esc(p.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(title)}">
    <line x1="${pad.l}" y1="${height - pad.b}" x2="${width - pad.r}" y2="${height - pad.b}" stroke="var(--border)"/>${lines}${labels}</svg>`;
}
function legend(items) {
  return `<div class="legend">${items.map((it, i) => `<span><i style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></i>${esc(it)}</span>`).join('')}</div>`;
}

// ---------- persona ----------
function setPersona(p) {
  state.persona = p;
  const m = state.meta;
  if (p === 'learner') state.learnerId = m.demoLearnerId;
  if (p === 'provider') state.providerId = m.demoProviderId;
  const labels = { guest: 'Potential Learner', learner: 'Registered Learner', provider: 'Course Provider', owner: 'Platform Owner' };
  document.getElementById('persona-label').textContent = labels[p];
  document.getElementById('nav-dashboard').hidden = (p === 'guest');
  localStorage.setItem('forge-persona', p);
}

// ---------- router ----------
const routes = {};
function go(route, params = {}) {
  location.hash = '#' + route + (params.id ? '/' + params.id : '');
}
function parseHash() {
  const h = location.hash.replace(/^#/, '') || 'home';
  const [route, id] = h.split('/');
  return { route, id };
}
async function render() {
  const { route, id } = parseHash();
  document.querySelectorAll('.nav-link').forEach((n) => n.classList.toggle('active', n.dataset.route === route));
  document.getElementById('clam').style.display = route === 'home' ? 'block' : 'none';
  main.innerHTML = '<p class="muted">Loading…</p>';
  const fn = routes[route] || routes.home;
  try { await fn(id); } catch (e) { main.innerHTML = `<div class="empty">Something went wrong: ${esc(e.message)}</div>`; }
  main.focus();
}

// ---------- views ----------
routes.home = async () => {
  main.innerHTML = '';
  main.appendChild(el(`<section class="hero">
    <h1>Learn in-demand skills. Earn recognised certificates.</h1>
    <p>${esc(state.brand.brandName)} brings video courses, downloadable readings, quizzes and certification tests together with analytics for learners, providers and platform owners.</p>
    <button class="btn" id="cta-browse">Browse the catalogue →</button>
  </section>`));
  main.querySelector('#cta-browse').onclick = () => go('catalogue');

  main.appendChild(el(`<h2 class="section-title">Choose a persona to explore</h2>`));
  const m = state.meta;
  const grid = el('<div class="grid persona-grid"></div>');
  const emojis = { guest: '🧭', learner: '🎓', provider: '🏫', owner: '📈' };
  for (const p of m.personas) {
    const card = el(`<button class="card persona-card">
      <div class="emoji" aria-hidden="true">${emojis[p.id]}</div>
      <h3>${esc(p.label)}</h3>
      <p class="muted small">${esc(p.desc)}</p></button>`);
    card.onclick = () => { setPersona(p.id); go(p.id === 'guest' ? 'catalogue' : 'dashboard'); };
    grid.appendChild(card);
  }
  main.appendChild(grid);

  // domains
  const domains = (await api('/api/domains')).data;
  main.appendChild(el(`<h2 class="section-title">Learning domains</h2>`));
  const dg = el('<div class="grid cards"></div>');
  for (const d of domains) {
    const c = el(`<button class="card course-card"><div class="row"><span style="font-size:1.6rem">${d.icon}</span><div><h3 style="margin:0">${esc(d.name)}</h3><span class="muted small">${d.courseCount} courses</span></div></div></button>`);
    c.onclick = () => { sessionStorage.setItem('filter-domain', d.id); go('catalogue'); };
    dg.appendChild(c);
  }
  main.appendChild(dg);
};

function courseCardEl(c) {
  const card = el(`<article class="card course-card" tabindex="0" role="button" aria-label="Open ${esc(c.title)}">
    <div class="row"><span class="chip level">${esc(c.level)}</span><span class="chip">${esc(c.format)}</span></div>
    <h3>${esc(c.title)}</h3>
    <p class="muted small">${esc(c.summary)}</p>
    <div class="spread small">
      <span>${esc(c.provider)}</span>
      <span class="rating">${c.rating ? '★ ' + c.rating : 'New'} <span class="muted">(${c.ratingCount})</span></span>
    </div>
    <div class="spread small muted"><span>${esc(c.domain)}</span><span>${c.durationHrs}h · ${c.lessonCount} lessons</span></div>
  </article>`);
  const open = () => go('course', { id: c.id });
  card.onclick = open;
  card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  return card;
}

routes.catalogue = async () => {
  main.innerHTML = '';
  const domains = (await api('/api/domains')).data;
  const presetDomain = sessionStorage.getItem('filter-domain') || '';
  sessionStorage.removeItem('filter-domain');
  const bar = el(`<div>
    <div class="spread"><h1>Course catalogue</h1></div>
    <div class="filters" role="search">
      <input type="search" id="q" placeholder="Search courses, providers, topics…" aria-label="Search courses" />
      <select id="domain" aria-label="Filter by domain"><option value="">All domains</option>${domains.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select>
      <select id="level" aria-label="Filter by level"><option value="">All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
      <select id="sort" aria-label="Sort"><option value="">Sort: Default</option><option value="rating">Top rated</option><option value="popular">Most popular</option></select>
    </div></div>`);
  main.appendChild(bar);
  const results = el('<div class="grid cards" id="results"></div>');
  main.appendChild(results);
  if (presetDomain) bar.querySelector('#domain').value = presetDomain;

  async function load() {
    const q = bar.querySelector('#q').value.trim();
    const domain = bar.querySelector('#domain').value;
    const level = bar.querySelector('#level').value;
    const sort = bar.querySelector('#sort').value;
    const params = new URLSearchParams();
    if (q) params.set('q', q); if (domain) params.set('domain', domain);
    if (level) params.set('level', level); if (sort) params.set('sort', sort);
    const list = (await api('/api/courses?' + params.toString())).data;
    results.innerHTML = '';
    if (!list.length) { results.appendChild(el('<div class="empty">No courses match your search.</div>')); return; }
    list.forEach((c) => results.appendChild(courseCardEl(c)));
  }
  bar.querySelector('#q').addEventListener('input', debounce(load, 250));
  ['#domain', '#level', '#sort'].forEach((s) => bar.querySelector(s).addEventListener('change', load));

  // recommendations
  const rec = (await api('/api/recommendations?' + (state.learnerId ? 'learnerId=' + state.learnerId : ''))).data;
  if (rec.length) {
    main.appendChild(el(`<h2 class="section-title">${state.persona === 'learner' ? 'Recommended for you' : 'Popular right now'}</h2>`));
    const rg = el('<div class="grid cards"></div>');
    rec.forEach((c) => rg.appendChild(courseCardEl(c)));
    main.appendChild(rg);
    main.appendChild(el('<h2 class="section-title">All courses</h2>'));
    main.appendChild(results);
  }
  await load();
};

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

routes.course = async (id) => {
  main.innerHTML = '';
  const url = '/api/courses/' + id + (state.learnerId ? '?learnerId=' + state.learnerId : '');
  const c = (await api(url)).data;
  if (!c || c.error) { main.innerHTML = '<div class="empty">Course not found.</div>'; return; }
  const back = el('<button class="link-btn back-link">← Back to catalogue</button>');
  back.onclick = () => go('catalogue');
  main.appendChild(back);

  main.appendChild(el(`<div class="spread">
    <div><h1>${esc(c.title)}</h1>
      <div class="row"><span class="chip level">${esc(c.level)}</span><span class="chip">${esc(c.format)}</span><span class="chip">${esc(c.domain)}</span>
      <span class="rating">★ ${c.rating.avg ?? '—'} <span class="muted small">(${c.rating.count} reviews)</span></span></div>
      <p class="muted">${esc(c.summary)} · by <strong>${esc(c.provider)}</strong> · ${c.durationHrs}h</p>
    </div></div>`));

  const isLearner = state.persona === 'learner';
  const prog = c.progress;
  if (isLearner && prog) {
    const pbar = el(`<div class="card"><div class="spread"><strong>Your progress</strong><span class="small muted">${prog.done}/${prog.total} lessons</span></div>
      <div class="progress" style="margin-top:.5rem"><span style="width:${prog.percent}%"></span></div></div>`);
    main.appendChild(pbar);
  }

  // Lessons
  main.appendChild(el('<h2 class="section-title">Course content</h2>'));
  const lessons = el('<div class="card"></div>');
  c.lessons.forEach((l) => {
    const done = prog && prog.completedLessonIds.includes(l.id);
    const row = el(`<div class="lesson">
      <span class="ltype">${l.type === 'video' ? '▶ Video' : '📄 Reading'}</span>
      <span style="flex:1">${esc(l.title)} <span class="muted small">· ${l.durationMin} min</span></span>
      ${done ? '<span class="done">✓ done</span>' : ''}
    </div>`);
    const actions = el('<span class="row"></span>');
    if (l.downloadable) {
      const dl = el('<a class="btn small ghost" href="/api/courses/' + c.id + '/lessons/' + l.id + '/download">Download</a>');
      actions.appendChild(dl);
    }
    if (isLearner && !done) {
      const b = el('<button class="btn small secondary">Mark done</button>');
      b.onclick = async () => {
        const r = await api(`/api/courses/${c.id}/complete-lesson`, { method: 'POST', body: { learnerId: state.learnerId, lessonId: l.id } });
        if (r.ok) { toast(r.data.completed ? 'Course completed! 🎉' : 'Lesson marked complete'); render(); }
      };
      actions.appendChild(b);
    }
    row.appendChild(actions);
    lessons.appendChild(row);
  });
  main.appendChild(lessons);

  // Quiz
  if (c.quiz.length) {
    main.appendChild(el('<h2 class="section-title">Knowledge check</h2>'));
    main.appendChild(quizBlock(c));
  }

  // Certification test (gated)
  if (isLearner) {
    main.appendChild(el('<h2 class="section-title">Certification</h2>'));
    main.appendChild(testBlock(c, prog));
    main.appendChild(el('<h2 class="section-title">Your feedback</h2>'));
    main.appendChild(feedbackForm(c, prog));
  }

  // Reviews / feedback thread
  main.appendChild(el('<h2 class="section-title">Learner reviews</h2>'));
  main.appendChild(reviewsBlock(c));
};

function quizBlock(c) {
  const wrap = el('<div class="card"></div>');
  c.quiz.forEach((q, qi) => {
    wrap.appendChild(el(`<p><strong>${qi + 1}. ${esc(q.prompt)}</strong></p>`));
    q.options.forEach((opt, oi) => {
      wrap.appendChild(el(`<label class="qopt" data-q="${q.id}"><input type="radio" name="${q.id}" value="${oi}">${esc(opt)}</label>`));
    });
  });
  const btn = el('<button class="btn">Check answers</button>');
  const out = el('<p class="small muted"></p>');
  btn.onclick = async () => {
    const answers = {};
    c.quiz.forEach((q) => { const sel = wrap.querySelector(`input[name="${q.id}"]:checked`); if (sel) answers[q.id] = Number(sel.value); });
    const r = await api(`/api/courses/${c.id}/quiz`, { method: 'POST', body: { answers } });
    out.textContent = `You scored ${r.data.correct}/${r.data.total} (${r.data.score}%).`;
  };
  wrap.appendChild(btn); wrap.appendChild(out);
  return wrap;
}

function testBlock(c, prog) {
  const wrap = el('<div class="card"></div>');
  if (!prog || !prog.completed) {
    wrap.appendChild(el(`<p class="muted">Finish all lessons to unlock the <strong>${esc(c.test.title)}</strong> (pass mark ${c.test.passScore}%). Passing earns your certificate.</p>`));
    wrap.appendChild(el('<button class="btn" disabled>Take certification test (locked)</button>'));
    return wrap;
  }
  wrap.appendChild(el(`<p>You have completed the course. Take the <strong>${esc(c.test.title)}</strong> (${c.test.questionCount} questions, pass ${c.test.passScore}%).</p>`));
  const start = el('<button class="btn">Start certification test</button>');
  wrap.appendChild(start);
  start.onclick = async () => {
    wrap.innerHTML = '';
    await renderTestForm(wrap, c);
  };
  return wrap;
}

async function renderTestForm(wrap, c) {
  const qres = await api('/api/courses/' + c.id + '/test-questions');
  const questions = qres.ok ? qres.data.questions : [];
  wrap.appendChild(el(`<h3>${esc(c.test.title)}</h3>`));
  questions.forEach((q, qi) => {
    wrap.appendChild(el(`<p><strong>${qi + 1}. ${esc(q.prompt)}</strong></p>`));
    q.options.forEach((opt, oi) => wrap.appendChild(el(`<label class="qopt" data-q="${q.id}"><input type="radio" name="${q.id}" value="${oi}">${esc(opt)}</label>`)));
  });
  const submit = el('<button class="btn">Submit test</button>');
  const out = el('<div class="small"></div>');
  submit.onclick = async () => {
    const answers = {};
    questions.forEach((q) => { const s = wrap.querySelector(`input[name="${q.id}"]:checked`); if (s) answers[q.id] = Number(s.value); });
    const r = await api(`/api/courses/${c.id}/test`, { method: 'POST', body: { learnerId: state.learnerId, answers } });
    if (r.data.passed) {
      out.innerHTML = `<p class="badge">✓ Passed with ${r.data.score}% — certificate issued!</p>`;
      toast('Certificate earned 🎓');
    } else {
      out.innerHTML = `<p class="badge warn">Scored ${r.data.score}%. You need ${r.data.passScore}% to pass — review and retry.</p>`;
    }
  };
  wrap.appendChild(submit); wrap.appendChild(out);
}

function feedbackForm(c, prog) {
  const wrap = el('<div class="card"></div>');
  if (!prog || !prog.completed) {
    wrap.appendChild(el('<p class="muted">You can rate and review this course once you have completed it. This keeps reviews trustworthy.</p>'));
    return wrap;
  }
  let score = 5;
  wrap.appendChild(el('<p>How would you rate this course?</p>'));
  const starRow = el('<div class="stars" role="radiogroup" aria-label="Rating"></div>');
  const draw = () => { [...starRow.children].forEach((b, i) => b.classList.toggle('on', i < score)); };
  for (let i = 1; i <= 5; i++) {
    const b = el(`<button class="star" role="radio" aria-label="${i} star" aria-checked="false">★</button>`);
    b.onclick = () => { score = i; draw(); };
    starRow.appendChild(b);
  }
  draw();
  const ta = el('<textarea rows="3" placeholder="Share what worked for you…" aria-label="Review comment"></textarea>');
  const btn = el('<button class="btn" style="margin-top:.6rem">Submit review</button>');
  btn.onclick = async () => {
    const r = await api(`/api/courses/${c.id}/feedback`, { method: 'POST', body: { learnerId: state.learnerId, score, comment: ta.value } });
    if (r.ok) { toast(r.data.updated ? 'Review updated' : 'Thanks for your review!'); render(); }
    else toast(r.data?.message || 'Could not submit review');
  };
  wrap.appendChild(starRow); wrap.appendChild(ta); wrap.appendChild(btn);
  return wrap;
}

function reviewsBlock(c) {
  const wrap = el('<div class="card"></div>');
  if (!c.feedback.length) { wrap.appendChild(el('<p class="muted">No reviews yet.</p>')); return wrap; }
  c.feedback.forEach((f) => {
    const t = el(`<div class="thread">
      <div class="spread"><strong>${esc(f.learner)}</strong><span class="rating">${stars(f.score)}</span></div>
      <p>${esc(f.comment)}</p><p class="muted small">${fmtDate(f.createdAt)}</p></div>`);
    f.replies.forEach((rp) => t.appendChild(el(`<div class="reply"><div class="who">${esc(rp.provider)} (provider)</div><p>${esc(rp.body)}</p><p class="muted small">${fmtDate(rp.createdAt)}</p></div>`)));
    // provider persona can reply directly from the course page
    if (state.persona === 'provider' && state.providerId === c.providerId) {
      const ta = el('<textarea rows="2" placeholder="Reply as provider…"></textarea>');
      const b = el('<button class="btn small secondary" style="margin-top:.4rem">Reply</button>');
      b.onclick = async () => {
        const r = await api(`/api/feedback/${f.id}/reply`, { method: 'POST', body: { providerId: state.providerId, body: ta.value } });
        if (r.ok) { toast('Reply posted'); render(); } else toast('Could not post reply');
      };
      t.appendChild(ta); t.appendChild(b);
    }
    wrap.appendChild(t);
  });
  return wrap;
}

// ---------- dashboards ----------
routes.dashboard = async () => {
  if (state.persona === 'learner') return learnerDashboard();
  if (state.persona === 'provider') return providerDashboard();
  if (state.persona === 'owner') return ownerDashboard();
  go('catalogue');
};

function exportButton(getData, filename) {
  const b = el('<button class="btn ghost small">⬇ Export dashboard (JSON)</button>');
  b.onclick = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    URL.revokeObjectURL(a.href); toast('Dashboard exported');
  };
  return b;
}

async function learnerDashboard() {
  main.innerHTML = '';
  const d = (await api('/api/learners/' + state.learnerId + '/dashboard')).data;
  const head = el(`<div class="spread"><div><h1>Welcome back, ${esc(d.learner.name.split(' ')[0])}</h1><p class="muted">Your learning at a glance</p></div></div>`);
  head.appendChild(exportButton(() => d, 'forge-learner-dashboard.json'));
  main.appendChild(head);

  const s = d.stats;
  main.appendChild(statTiles([
    ['Completed', s.completed], ['In progress', s.inProgress], ['Certificates', s.certificates], ['Wishlist', s.wishlist],
  ]));

  // Roadmap
  main.appendChild(el('<h2 class="section-title">🤖 Your AI learning roadmap</h2>'));
  const rm = el(`<div class="card"><p>${esc(d.roadmap.summary)}</p></div>`);
  d.roadmap.steps.forEach((st) => {
    const row = el(`<div class="lesson"><span class="ltype">Step ${st.order}</span>
      <span style="flex:1"><strong>${esc(st.title)}</strong> <span class="muted small">· ${esc(st.level)} · ${st.durationHrs}h</span><br><span class="muted small">${esc(st.reason)}</span></span></div>`);
    const b = el('<button class="btn small secondary">Open</button>'); b.onclick = () => go('course', { id: st.courseId });
    row.appendChild(b); rm.appendChild(row);
  });
  main.appendChild(rm);

  // In progress + completed
  twoCol(
    ['In progress', d.inProgress, (c) => {
      const row = el(`<div class="card" style="margin-bottom:.6rem"><div class="spread"><strong>${esc(c.title)}</strong><span class="small muted">${c.percent}%</span></div>
        <div class="progress" style="margin:.4rem 0"><span style="width:${c.percent}%"></span></div></div>`);
      row.onclick = () => go('course', { id: c.id }); row.style.cursor = 'pointer';
      return row;
    }],
    ['Completed courses', d.completed, (c) => {
      const row = el(`<div class="card" style="margin-bottom:.6rem"><div class="spread"><strong>${esc(c.title)}</strong><span class="badge">✓ ${fmtDate(c.completedAt)}</span></div></div>`);
      row.onclick = () => go('course', { id: c.id }); row.style.cursor = 'pointer';
      return row;
    }]
  );

  // Certificates + exams
  main.appendChild(el('<h2 class="section-title">Certificates</h2>'));
  if (d.certificates.length) {
    const g = el('<div class="grid cards"></div>');
    d.certificates.forEach((c) => g.appendChild(el(`<div class="card"><div class="badge">🎓 Certified</div><h3>${esc(c.course)}</h3><p class="muted small">${esc(c.provider)} · ${fmtDate(c.issuedAt)} · score ${c.score}%</p></div>`)));
    main.appendChild(g);
  } else main.appendChild(el('<div class="empty">No certificates yet — complete a course and pass its test.</div>'));

  main.appendChild(el('<h2 class="section-title">Scheduled exams</h2>'));
  if (d.exams.length) {
    const t = el('<div class="card"></div>');
    d.exams.forEach((e) => t.appendChild(el(`<div class="lesson"><span style="flex:1">${esc(e.course)}</span><span class="chip">${fmtDate(e.scheduledFor)}</span></div>`)));
    main.appendChild(t);
  } else main.appendChild(el('<div class="empty">No exams scheduled.</div>'));

  // Calendar
  main.appendChild(el('<h2 class="section-title">Learning calendar</h2>'));
  const cal = el('<div class="card cal"></div>');
  d.calendar.forEach((e) => cal.appendChild(el(`<div class="cal-item"><span class="cal-dot dot-${e.type}"></span><span class="small muted" style="min-width:90px">${fmtDate(e.date)}</span><span>${esc(e.course)} <span class="muted small">— ${e.type}</span></span></div>`)));
  main.appendChild(cal);
  main.appendChild(el(legend(['Started', 'Completed', 'Certified', 'Exam'])));
}

async function providerDashboard() {
  main.innerHTML = '';
  const d = (await api('/api/providers/' + state.providerId + '/dashboard')).data;
  const head = el(`<div class="spread"><div><h1>${esc(d.provider.name)}</h1><p class="muted">Provider analytics</p></div></div>`);
  head.appendChild(exportButton(() => d, 'forge-provider-dashboard.json'));
  main.appendChild(head);

  const t = d.totals;
  main.appendChild(statTiles([
    ['Courses', t.courses], ['Wishlisted', t.wishlisted], ['Active learners', t.active],
    ['Completions', t.completed], ['Certificates', t.certificates], ['Awaiting reply', t.awaitingReply],
  ]));

  main.appendChild(el('<h2 class="section-title">Enrolments vs completions by course</h2>'));
  const chartCard = el('<div class="card chart-card"></div>');
  chartCard.appendChild(el(lineChart([
    { name: 'Enrolled', points: d.courses.map((c) => ({ label: c.title.slice(0, 6), value: c.enrolled })) },
    { name: 'Completed', points: d.courses.map((c) => ({ label: c.title.slice(0, 6), value: c.completed })) },
  ], { title: 'Enrolments vs completions by course' })));
  chartCard.appendChild(el(legend(['Enrolled', 'Completed'])));
  main.appendChild(chartCard);

  main.appendChild(el('<h2 class="section-title">Course performance</h2>'));
  const table = el(`<div class="card"><table><thead><tr><th>Course</th><th>Wishlist</th><th>Active</th><th>Completed</th><th>Certs</th><th>Tests (pass)</th><th>Rating</th></tr></thead><tbody></tbody></table></div>`);
  const tb = table.querySelector('tbody');
  d.courses.forEach((c) => {
    const tr = el(`<tr><td><button class="link-btn">${esc(c.title)}</button></td><td>${c.wishlisted}</td><td>${c.active}</td><td>${c.completed}</td><td>${c.certificates}</td><td>${c.testsTaken} (${c.testsPassed})</td><td>${c.rating ?? '—'}</td></tr>`);
    tr.querySelector('button').onclick = () => go('course', { id: c.id });
    tb.appendChild(tr);
  });
  main.appendChild(table);

  main.appendChild(el('<h2 class="section-title">Learner feedback — reply threads</h2>'));
  if (!d.threads.length) main.appendChild(el('<div class="empty">No feedback yet.</div>'));
  d.threads.forEach((f) => {
    const card = el(`<div class="card" style="margin-bottom:.8rem">
      <div class="spread"><strong>${esc(f.course)}</strong>${f.needsReply ? '<span class="badge warn">Awaiting reply</span>' : '<span class="badge">Replied</span>'}</div>
      <div class="thread"><div class="spread"><span>${esc(f.learner)}</span><span class="rating">${stars(f.score)}</span></div><p>${esc(f.comment)}</p><p class="muted small">${fmtDate(f.createdAt)}</p></div>
    </div>`);
    const thread = card.querySelector('.thread');
    f.replies.forEach((rp) => thread.appendChild(el(`<div class="reply"><div class="who">${esc(rp.provider)}</div><p>${esc(rp.body)}</p><p class="muted small">${fmtDate(rp.createdAt)}</p></div>`)));
    const ta = el('<textarea rows="2" placeholder="Reply publicly to this learner…"></textarea>');
    const b = el('<button class="btn small secondary" style="margin-top:.4rem">Post reply</button>');
    b.onclick = async () => {
      const r = await api(`/api/feedback/${f.id}/reply`, { method: 'POST', body: { providerId: state.providerId, body: ta.value } });
      if (r.ok) { toast('Reply posted — visible to everyone'); render(); } else toast('Could not post reply');
    };
    card.appendChild(ta); card.appendChild(b);
    main.appendChild(card);
  });
}

async function ownerDashboard() {
  main.innerHTML = '';
  const d = (await api('/api/owner/dashboard')).data;
  const head = el(`<div class="spread"><div><h1>Platform overview</h1><p class="muted">Quality, attendance, completion & certification</p></div></div>`);
  head.appendChild(exportButton(() => d, 'forge-owner-dashboard.json'));
  main.appendChild(head);

  const k = d.kpis;
  main.appendChild(statTiles([
    ['Learners', k.learners], ['Providers', k.providers], ['Courses', k.courses],
    ['Enrolments', k.enrolments], ['Completion rate', k.completionRate + '%'], ['Certificates', k.certificates],
    ['Test pass rate', k.testPassRate + '%'], ['Exams in progress', k.testsInProgress], ['Avg rating', (k.avgFeedbackScore ?? '—') + ' ★'],
  ]));

  main.appendChild(el('<h2 class="section-title">Enrolments & completions (last 6 months)</h2>'));
  const trend = el('<div class="card chart-card"></div>');
  trend.appendChild(el(lineChart([
    { name: 'Enrolments', points: d.trend.map((m) => ({ label: m.label, value: m.enrolments })) },
    { name: 'Completions', points: d.trend.map((m) => ({ label: m.label, value: m.completions })) },
  ], { title: 'Enrolments and completions over time' })));
  trend.appendChild(el(legend(['Enrolments', 'Completions'])));
  main.appendChild(trend);

  twoCol(
    ['Enrolments by domain', null, null, () => {
      const card = el('<div class="card chart-card"></div>');
      card.appendChild(el(barChart(d.byDomain.map((x) => ({ label: x.domain.slice(0, 5), value: x.enrolments })), { title: 'Enrolments by domain', color: CHART_COLORS })));
      return card;
    }],
    ['Top-rated courses', null, null, () => {
      const card = el('<div class="card"></div>');
      d.topCourses.forEach((c) => card.appendChild(el(`<div class="lesson"><span style="flex:1">${esc(c.title)}</span><span class="rating">★ ${c.rating ?? '—'}</span></div>`)));
      return card;
    }]
  );

  main.appendChild(el('<h2 class="section-title">Governance</h2>'));
  const gcard = el('<div class="card"><p class="muted small">Recent audited actions (information governance). Learners can export or erase their data under the catalogue footer.</p></div>');
  const audit = (await api('/api/governance/audit')).data;
  if (!audit.length) gcard.appendChild(el('<p class="muted small">No audited actions yet this session.</p>'));
  audit.slice(0, 10).forEach((a) => gcard.appendChild(el(`<div class="lesson small"><span class="ltype">${fmtDate(a.at)}</span><span style="flex:1">${esc(a.action)}</span><span class="muted">${esc(JSON.stringify(a.meta))}</span></div>`)));
  main.appendChild(gcard);
}

routes.governance = async () => {
  main.innerHTML = '';
  main.appendChild(el(`<h1>Privacy, security & information governance</h1>
    <div class="card"><p>${esc(state.brand.brandName)} is a demonstration platform. It follows security and governance best practices:</p>
    <ul>
      <li>Strict Content-Security-Policy, <code>X-Content-Type-Options</code>, <code>X-Frame-Options: DENY</code> and no-referrer headers.</li>
      <li>Server-side validation and completion-gated feedback to protect data integrity.</li>
      <li>Every privileged action (certificate issue, data export, downloads) is written to an audit log.</li>
      <li>Accessible by design: skip links, keyboard support, ARIA roles, reduced-motion support and WCAG-aware colour contrast.</li>
      <li>Data subject rights: export your learning record, or request erasure.</li>
    </ul></div>`));
  if (state.persona === 'learner') {
    const card = el('<div class="card" style="margin-top:1rem"><h3>Your data</h3></div>');
    const ex = el('<a class="btn ghost" href="/api/learners/' + state.learnerId + '/export">⬇ Export my learning record (JSON)</a>');
    card.appendChild(ex);
    main.appendChild(card);
  } else {
    main.appendChild(el('<p class="muted" style="margin-top:1rem">Switch to the Registered Learner persona to export a personal data record.</p>'));
  }
};

// ---------- marketing pages (public front door) ----------
routes.features = async () => {
  main.innerHTML = '';
  main.appendChild(el(`<section class="hero"><h1>Everything you need to learn, certify and measure</h1>
    <p>${esc(state.brand.brandName)} brings content, assessment and analytics into one accessible, secure platform — for learners, course providers and platform owners alike.</p></section>`));
  const feats = [
    ['🎥 Mixed-format content', 'Self-paced video lessons with captions and transcripts, downloadable readings, and knowledge-check quizzes — all in one player.'],
    ['🏅 Quiz → test → certificate', 'Finish the lessons, pass the certification test, and earn a verifiable certificate. Gating is enforced on the server, never the client.'],
    ['💬 Trusted feedback', 'Only learners who complete a course can review it. Providers reply in a public thread, so ratings stay honest and useful.'],
    ['🤖 AI learning roadmap', 'A personalised, ordered path built from each learner’s history, wishlist and interests — with no personal data leaving the platform.'],
    ['🗓 Wishlist & calendar', 'Learners curate a wishlist and see started, completed, certified and scheduled-exam events on one progress calendar.'],
    ['📊 Role-based dashboards', 'Tailored, exportable dashboards for learners, providers and the platform owner — attendance, completion, pass rates and quality.'],
    ['🔐 Secure by default', 'Real authentication, RBAC enforced on every protected route, strict security headers, parameterised queries and an immutable audit log.'],
    ['♿ Accessible & responsive', 'WCAG 2.1 AA colour contrast, full keyboard support, semantic landmarks and layouts that work from 375px to desktop.'],
  ];
  const grid = el('<div class="grid cards"></div>');
  feats.forEach(([t, d]) => grid.appendChild(el(`<article class="card"><h3>${esc(t)}</h3><p class="muted small">${esc(d)}</p></article>`)));
  main.appendChild(grid);
  const cta = el('<button class="btn" style="margin-top:1.5rem">Explore the catalogue →</button>');
  cta.onclick = () => go('catalogue');
  main.appendChild(cta);
};

routes.pricing = async () => {
  main.innerHTML = '';
  main.appendChild(el(`<section class="hero"><h1>Simple, transparent pricing</h1>
    <p>Start with a free trial. Upgrade when you are ready — no permanent free tier, no surprises. Prices shown are indicative monthly rates.</p></section>`));
  const tiers = [
    { name: 'Starter', price: '$29', per: '/month', blurb: 'For individuals and small teams getting started.', cta: 'Start free trial', feats: ['Full course catalogue', 'Quizzes & certification tests', 'Personal certificates', 'AI learning roadmap', 'Email support'] },
    { name: 'Pro', price: '$99', per: '/month', blurb: 'For growing teams that need provider tools & analytics.', cta: 'Start free trial', featured: true, feats: ['Everything in Starter', 'Provider dashboards', 'Feedback reply threads', 'Exportable dashboards (CSV/JSON)', 'Priority support'] },
    { name: 'Enterprise', price: 'Custom', per: '', blurb: 'For institutions needing SSO, governance & scale.', cta: 'Contact sales', feats: ['Everything in Pro', 'SSO (OpenID Connect)', 'Owner oversight & audit log', 'Data residency & DPA', 'Dedicated onboarding'] },
  ];
  const grid = el('<div class="grid cards" role="list"></div>');
  tiers.forEach((t) => {
    const card = el(`<article class="card${t.featured ? ' featured' : ''}" role="listitem">
      ${t.featured ? '<span class="chip level">Most popular</span>' : ''}
      <h3>${esc(t.name)}</h3>
      <p><strong style="font-size:1.8rem">${esc(t.price)}</strong><span class="muted">${esc(t.per)}</span></p>
      <p class="muted small">${esc(t.blurb)}</p>
      <ul>${t.feats.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
    </article>`);
    const b = el(`<button class="btn${t.featured ? '' : ' ghost'}">${esc(t.cta)}</button>`);
    b.onclick = () => { go('home'); toast(t.cta === 'Contact sales' ? 'Pick a persona to explore the demo — or contact sales@cognivo.demo' : 'Pick a persona to start exploring the demo'); };
    card.appendChild(b);
    grid.appendChild(card);
  });
  main.appendChild(grid);

  // Feature comparison matrix
  main.appendChild(el('<h2 class="section-title">Compare plans</h2>'));
  const rows = [
    ['Course catalogue & certificates', '✓', '✓', '✓'],
    ['AI learning roadmap', '✓', '✓', '✓'],
    ['Provider dashboards & feedback threads', '—', '✓', '✓'],
    ['Exportable dashboards', '—', '✓', '✓'],
    ['Platform-owner oversight & audit log', '—', '—', '✓'],
    ['SSO (OpenID Connect)', '—', '—', '✓'],
    ['Data residency & DPA', '—', '—', '✓'],
  ];
  const wrap = el('<div class="table-scroll" tabindex="0" role="region" aria-label="Plan comparison"></div>');
  const table = el(`<table><thead><tr><th scope="col">Feature</th><th scope="col">Starter</th><th scope="col">Pro</th><th scope="col">Enterprise</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table>`);
  wrap.appendChild(table);
  main.appendChild(wrap);
};

routes.about = async () => {
  main.innerHTML = '';
  main.appendChild(el(`<section class="hero"><h1>About ${esc(state.brand.brandName)}</h1>
    <p>We believe high-quality learning and recognised credentials should be accessible to everyone, everywhere — on any connection, on any device.</p></section>`));
  main.appendChild(el(`<div class="card"><h3>Our mission</h3><p class="muted">To help learners build in-demand skills through flexible, self-paced courses, and to give providers and institutions the tools to deliver and measure that learning with confidence.</p></div>`));
  main.appendChild(el(`<div class="card" style="margin-top:1rem"><h3>How it works</h3><ul>
    <li><strong>Learners</strong> browse a searchable catalogue, learn through video and reading, take quizzes, and earn certificates.</li>
    <li><strong>Providers</strong> see demand, progress and certification across their courses and reply to learner feedback.</li>
    <li><strong>Platform owners</strong> oversee quality, attendance, completion and testing success across the whole platform.</li>
  </ul></div>`));
  main.appendChild(el(`<div class="card" style="margin-top:1rem"><h3>Built responsibly</h3><p class="muted">Accessibility (WCAG 2.1 AA), security-by-default, and information governance are built in from the start — not bolted on. See our <button class="link-btn" onclick="location.hash='#governance'">privacy &amp; governance</button> page.</p></div>`));
};

routes.faq = async () => {
  main.innerHTML = '';
  main.appendChild(el('<h1>Frequently asked questions</h1>'));
  const faqs = [
    ['Is this a live product or a demo?', 'This is a fully working demo. No sign-in is required — choose a persona (potential learner, registered learner, course provider or platform owner) to explore each experience with realistic seeded data.'],
    ['How do certificates work?', 'Complete every lesson in a course to unlock its certification test. Score at or above the pass mark and a certificate is issued to your learner record automatically.'],
    ['Who can leave course feedback?', 'Only learners who have completed a course can rate and review it. Course providers can reply, and the conversation is shown as a public thread.'],
    ['How is the learning roadmap generated?', 'By default a deterministic, privacy-preserving generator builds an ordered path from your history, wishlist and interests. An optional LLM backend can be enabled via configuration.'],
    ['Can I export my data?', 'Yes. Learners can export their full learning record as JSON, and owners can export dashboards as CSV/JSON. Data erasure is supported for information-governance compliance.'],
    ['What about security and accessibility?', 'Authentication, role-based access control and tenant isolation are enforced on the server. The interface targets WCAG 2.1 AA and is fully keyboard-operable and responsive to 375px.'],
  ];
  const list = el('<div></div>');
  faqs.forEach(([q, a]) => list.appendChild(el(`<details class="card" style="margin-bottom:.75rem"><summary><strong>${esc(q)}</strong></summary><p class="muted" style="margin-top:.5rem">${esc(a)}</p></details>`)));
  main.appendChild(list);
};

routes.terms = async () => {
  main.innerHTML = '';
  main.appendChild(el('<h1>Terms of Service</h1>'));
  main.appendChild(el(`<div class="card"><p class="muted">These demonstration Terms govern use of ${esc(state.brand.brandName)}. By using the platform you agree to use it lawfully and not to attempt to disrupt or compromise it.</p>
    <ul>
      <li><strong>Demo content.</strong> Courses, learners and results shown are sample data for evaluation only.</li>
      <li><strong>Acceptable use.</strong> Do not misuse the service, attempt unauthorised access, or upload unlawful content.</li>
      <li><strong>Certificates.</strong> Demo certificates are illustrative and confer no formal accreditation.</li>
      <li><strong>Liability.</strong> The platform is provided “as is” for demonstration, without warranty.</li>
      <li><strong>Privacy.</strong> See our <button class="link-btn" onclick="location.hash='#governance'">Privacy &amp; Governance</button> page for how data is handled.</li>
    </ul></div>`));
};

// ---------- small layout helpers ----------
function statTiles(pairs) {
  const g = el('<div class="grid stats"></div>');
  pairs.forEach(([lbl, n]) => g.appendChild(el(`<div class="stat"><div class="n">${esc(n)}</div><div class="lbl">${esc(lbl)}</div></div>`)));
  return g;
}
function twoCol(a, b) {
  main.appendChild(el(`<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))"><div id="colA"></div><div id="colB"></div></div>`));
  const colA = main.querySelector('#colA'); const colB = main.querySelector('#colB');
  const fill = (col, [title, list, renderItem, customRender]) => {
    col.appendChild(el(`<h2 class="section-title">${esc(title)}</h2>`));
    if (customRender) { col.appendChild(customRender()); return; }
    if (!list || !list.length) { col.appendChild(el('<div class="empty">Nothing here yet.</div>')); return; }
    list.forEach((item) => col.appendChild(renderItem(item)));
  };
  fill(colA, a); fill(colB, b);
}

// ---------- clam easter egg ----------
document.getElementById('clam').addEventListener('click', () => {
  toast('🦪 You found the pearl of wisdom: "A little practice every day beats cramming." ✨');
});

// ---------- persona switch button ----------
document.getElementById('switch-persona').addEventListener('click', () => { go('home'); });
document.querySelectorAll('[data-route]').forEach((n) => n.addEventListener('click', () => go(n.dataset.route)));

// ---------- boot ----------
(async function boot() {
  const [meta, brand] = await Promise.all([api('/api/meta'), api('/api/brand')]);
  state.meta = meta.data;
  applyBrand(brand.data);
  const saved = localStorage.getItem('forge-persona') || 'guest';
  setPersona(saved);
  window.addEventListener('hashchange', render);
  await render();
})();
