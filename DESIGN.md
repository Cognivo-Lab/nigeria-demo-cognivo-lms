# Cognivo LMS — Design System & UX Specification

**Product:** Cognivo LMS (operator-named). White-label platform; first instance
`nigeria-demo`; default brand when unset: **Nigeria Demo**.
**Stage:** plan. **Author:** design specialist (product & UX shape).
**Date:** 2026-11-12.
**Source of truth for scope:** PRD.md §6 and INTERVIEW.md. Positioning: STRATEGY.md.
File-level plan: PLAN.md. Architecture: ARCHITECTURE.md. This document is the UX
counterpart to PLAN.md — it specifies *what every screen looks like, how it behaves
in every state, and the tokens the build renders against*. It does not re-argue
scope or stack.

The companion artifact is **`wireframe.html`** — a single, self-contained, viewable
file that renders the token system and the key screens, and that itself satisfies
375px / WCAG AA (light + dark) / keyboard. It is the first thing the responsive +
contrast gate measures; it is built to pass by construction (see §12).

---

## 1. Design principles (the five that decide ties)

1. **The credential is the hero.** Every learner screen keeps the path *browse →
   learn → quiz → certification test → certificate* visible. Progress is never
   hidden behind a click. This is the product's answer to the 3–15% completion
   base-rate (PRD §1) — the UX fights drop-off, it does not assume completion.
2. **Populated on first paint.** This is a demo that is also the product
   (STRATEGY.md §4). On the demo path there are **no empty states** — the seed
   fills every chart and list. Empty states exist in the component kit for the
   production profile (first-run, a brand-new learner), never on the prospect's
   click-through.
3. **Oversight is a product, not a report.** Provider and owner dashboards are
   decision surfaces: a funnel that shows where learners fall out, a feedback
   thread a provider can answer in two clicks. They read like a cockpit the buyer
   would run their programme from (STRATEGY.md §5).
4. **Light by default, honest about bandwidth.** The instance geography is
   connectivity-constrained (STRATEGY.md §3C). Pages are light, reading downloads
   work offline, video is never auto-played and never a hard dependency for
   progress. Skeletons, not spinners; lazy charts below the fold.
5. **Accessible is the baseline, not a pass.** 375px, AA in both themes, and
   full keyboard operation are design constraints enforced at token and component
   level (§4), proven on `wireframe.html`, not retrofitted at test time.

---

## 2. Brand & white-label theming

Branding is a *config surface*, not hard-coded art. `BrandProvider`
(`web/src/components/BrandProvider.tsx`) reads `/api/brand` and sets three things:
the wordmark in the header, the `<title>`, and the footer line. Default brand name
is **Nigeria Demo** when `org.brand_name`/`BRAND_NAME` is unset (PLAN §6,
`server/src/config/brand.ts`).

- **Brand accent is one token** (`--brand`), used for primary actions, the active
  nav marker, focus accents, and the logo lockup. Swapping an instance's accent is
  one variable; everything else is neutral ink + surfaces so a rebrand never breaks
  contrast. The dataviz categorical palette (§9) is **independent of the brand
  accent** so charts stay colourblind-safe whatever brand colour an instance picks.
- **Wordmark:** text lockup `{brandName}` in the system sans, weight 700, with a
  small mark (a rounded "C" glyph for the default Cognivo identity; instances may
  supply `logo_url`). No external font — `system-ui` stack only, which also keeps
  pages light (principle 4).
- **The clam shell** (§10) is a fixed brand flourish on the public homepage only,
  specified by the brief; it is *not* part of the reusable shell.

Device appearance (Light / Dark / System) is a **separate** axis from brand, per
the Forge appearance mandate — see §3.2 and §4.

---

## 3. Design tokens

All colours are CSS custom properties on `:root`, re-declared under
`@media (prefers-color-scheme: dark)` and under `:root[data-theme="dark"]` /
`[data-theme="light"]` so the explicit toggle wins over the OS in both directions
(the pattern from the dataviz palette reference). Tokens live in
`web/src/theme/tokens.css`; the toggle in `web/src/theme/ThemeProvider.tsx`.

### 3.1 Colour — light theme (surface `#ffffff`, page `#f9fafb`)

| Token | Hex | Role | Contrast evidence |
|---|---|---|---|
| `--page` | `#f9fafb` | app background plane | — |
| `--surface` | `#ffffff` | cards, sheets, header | — |
| `--surface-raised` | `#f6f7f9` | nested/raised card, table header | — |
| `--ink` | `#16181d` | primary text | 17.8:1 on surface, 16.6:1 on raised |
| `--ink-secondary` | `#51555e` | secondary text, labels | 7.5:1 / 7.0:1 |
| `--ink-muted` | `#6b7079` | captions, axis, placeholder | 4.98:1 on surface (AA normal) |
| `--brand` | `#4f46e5` | primary button fill, active marker | white text on it = **6.29:1** |
| `--brand-ink` | `#ffffff` | text on `--brand` | 6.29:1 |
| `--link` | `#3730b3` | links, brand-tinted text, chip text | 9.4:1 |
| `--focus` | `#4338ca` | focus ring | 7.9:1 on surface, 7.4:1 on raised (≥3:1 non-text) |
| `--success` | `#136c2e` | success text/icon | 6.5:1 |
| `--danger` | `#b42318` | error text/icon | 6.6:1 |
| `--warn-ink` | `#8a5a00` | warning text (always + icon) | 5.9:1 |
| `--border` | `#e4e6ea` | decorative hairline divider | non-text decorative (no 3:1 req) |
| `--border-control` | `#8a8f99` | input/control boundary | 3.25:1 on surface, 3.03:1 on raised (≥3:1) |
| `--chip-bg` | `#eef0fb` | brand-tinted chip | brand text `--link` on it = 8.3:1 |
| `--clamshell` | `#f5c518` | clam-shell icon fill | dark glyph `#16181d` on it = 10.9:1 |

### 3.2 Colour — dark theme (surface `#15171c`, page `#0e1013`)

| Token | Hex | Role | Contrast evidence |
|---|---|---|---|
| `--page` | `#0e1013` | app background plane | — |
| `--surface` | `#15171c` | cards, sheets, header | — |
| `--surface-raised` | `#1d2026` | nested/raised card, table header | — |
| `--ink` | `#e9eaee` | primary text | 14.9:1 on surface, 13.6:1 on raised |
| `--ink-secondary` | `#b4b8c0` | secondary text | 9.0:1 / 8.2:1 |
| `--ink-muted` | `#9095a0` | captions, axis | 5.97:1 |
| `--brand` | `#4f46e5` | primary button fill | white text on it = 6.29:1 (label carries the boundary; dark buttons add a 1px `--border-control` ring) |
| `--link` | `#a5b4fc` | links, brand-tinted text | 9.0:1 on surface, 8.2:1 on raised |
| `--focus` | `#a5b4fc` | focus ring | 9.0:1 / 8.2:1 (≥3:1 non-text) |
| `--success` | `#4ade80` | success text/icon | 10.3:1 |
| `--danger` | `#fca5a5` | error text/icon | 9.5:1 |
| `--warn-ink` | `#fcd34d` | warning text | 12.4:1 |
| `--border` | `#2a2e36` | decorative hairline | non-text decorative |
| `--border-control` | `#6a6f7a` | input/control boundary | 3.56:1 on surface, 3.24:1 on raised (≥3:1) |
| `--chip-bg` | `#262a4d` | brand-tinted chip | `--link` on it = 6.9:1 |
| `--clamshell` | `#f5c518` | clam-shell fill (homepage is dark-on-light always) | 10.9:1 with dark glyph |

> Every text token above meets WCAG 2.1 AA (≥4.5:1 normal, ≥3:1 large) on the
> surfaces it is used on, in **both** themes. Every control boundary and focus
> ring meets the ≥3:1 non-text contrast rule. These numbers were computed, not
> eyeballed (the WCAG ratios above and the chart-palette CVD figures in §9 are
> from the validator run during this stage).

### 3.3 Type scale (system sans: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`)

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `--fs-display` | 2.0rem / 1.15 (clamp down to 1.5rem at 375px) | 700 | marketing hero, cert name |
| `--fs-h1` | 1.5rem / 1.2 | 700 | page title |
| `--fs-h2` | 1.25rem / 1.25 | 650 | section heading |
| `--fs-h3` | 1.0625rem / 1.3 | 600 | card heading |
| `--fs-body` | 1rem / 1.5 | 400 | body (never below 16px, keeps mobile legible + prevents iOS zoom on inputs) |
| `--fs-small` | 0.875rem / 1.45 | 400/500 | meta, captions, chips |
| `--fs-mono-num` | inherits; `font-variant-numeric: tabular-nums` | — | table/axis/stat-tile aligned numerals |

Display and H1 use `clamp()` so headings shrink gracefully to 375px without
overflow. Long unbroken strings (certificate serials, verify codes, emails, URLs)
carry `overflow-wrap: anywhere`.

### 3.4 Spacing, radius, elevation, motion

- **Space scale (4px base):** `--s1 4 · --s2 8 · --s3 12 · --s4 16 · --s5 24 ·
  --s6 32 · --s7 48 · --s8 64`. Page gutters: 16px at ≤375px, 24px ≥640px, 32px
  ≥1024px.
- **Radius:** `--r-sm 6 · --r-md 10 · --r-lg 16 · --r-pill 999`. Cards `--r-lg`,
  controls `--r-md`, chips/badges `--r-pill`.
- **Elevation:** flat by default (hairline `--border`). One soft shadow token
  `--shadow-1` for modals/popovers/sticky header-on-scroll only. Dark theme uses a
  lighter raised *surface* rather than heavy shadow.
- **Motion:** 150ms ease for hover/press, 200ms for enter/leave. **All transitions
  and the skeleton shimmer are wrapped in `@media (prefers-reduced-motion: reduce)`
  → none.** No parallax, no autoplay.

---

## 4. Accessibility specification (build requirement, measured on the wireframe)

This is enforced where it is built, not deferred to QA. Each UI feature in
SCOPE.json already carries "fits 375px" and "meets AA in every theme shipped" in
its definition of done; this section is the how.

**Responsive to 375px (no horizontal overflow at 375×667):**
- No element outside a `@media (min-width: …)` block sets a fixed `width`,
  `min-width`, or grid/flex track wider than 375px. Layout uses `max-width`,
  `grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr))`,
  `flex-wrap: wrap`, and `min-width: 0` on flex/grid children so they may shrink.
- Any table that cannot fit (owner metrics, audit log) lives in a
  `.table-scroll` container with `overflow-x: auto` **and `tabindex="0"`** so a
  keyboard can reach and scroll it, with an accessible name via `aria-label`.
- Images/media use `max-width: 100%`. The course player video is a responsive
  16:9 box that reflows above the lesson list on narrow screens.

**WCAG 2.1 AA contrast (both themes):** guaranteed by the §3 token tables. Status
colour is **never alone** — every success/warning/danger state ships an icon +
text label (the status palette's sub-3:1 light fills are mitigated by the icon +
label pairing, per the dataviz status rule). Chart fills below 3:1 on the light
surface trigger the **relief rule**: direct value labels + a table view (§9).

**Keyboard & semantics:**
- Landmarks on every page: one `<header>` (banner), `<nav>`, `<main id="main">`,
  `<footer>`. A **skip link** ("Skip to content") is the first focusable element,
  visible on focus, jumping to `#main`.
- Every control has an accessible name (visible `<label for>`, `aria-label`, or
  `aria-labelledby`). Icon-only buttons (clam shell, theme toggle, export) carry
  `aria-label`. Every `<img>` has `alt` (empty `alt=""` when decorative).
- **Visible focus ring** (`2px solid var(--focus)` + 2px offset) on every
  interactive element; `:focus-visible` so mouse users aren't noised, but it is
  never removed without replacement.
- Tab order follows reading order. Modals (`Modal`) trap focus, close on `Esc`,
  restore focus to the trigger, and set `aria-modal="true"` +
  `role="dialog"` + `aria-labelledby`. Tabs (`Tabs`) use the
  roving-tabindex `tablist/tab/tabpanel` pattern with arrow-key navigation.
  Toasts use `role="status"` (polite) or `role="alert"` (assertive for errors).
- Forms: label + input programmatically linked; errors via `aria-describedby`
  and `aria-invalid`; the first invalid field receives focus on submit; error
  summary announced via `aria-live="assertive"`.
- The persona switch, calendar grid, and quiz radio groups are reachable and
  operable by keyboard alone — proven by the Playwright keyboard journey (PLAN
  `web/e2e`), prototyped in `wireframe.html`.
- Live regions: quiz score, roadmap-generating state, and save confirmations use
  `aria-live` so screen-reader users hear the result without a focus jump.

**Reduced motion / forced colors:** motion gated as in §3.4; charts expose a
texture fill and table view for `forced-colors` and CVD readers (§9).

---

## 5. Component library

Maps 1:1 to `web/src/components/*` (PLAN §4). Every component ships **loading /
empty / error** affordances where it owns data, and is keyboard + AA compliant.

| Component | Responsibility | States / a11y notes |
|---|---|---|
| `Button` | primary / secondary / ghost / danger; icon-left slot; `loading` shows spinner + `aria-busy`, disables | min 44×44px target; focus ring; label never icon-only without `aria-label` |
| `FormField` | label + control + hint + inline error | links error with `aria-describedby`, sets `aria-invalid`; 16px input text |
| `Input` / `Select` / `Textarea` | bounded text, search, dropdown | `--border-control` boundary (≥3:1); clear focus ring |
| `Card` | content container, hairline, `--r-lg` | optional heading id for `aria-labelledby` |
| `Modal` | focus-trapped dialog | `role=dialog`, `aria-modal`, Esc close, focus restore |
| `Tabs` | persona sub-nav, dashboard sections | `tablist` roving tabindex, arrow keys |
| `Table` | sortable data table | wrapped in `.table-scroll` (`tabindex=0`, `aria-label`); `scope` on `th`; `tabular-nums` |
| `Badge` / `Chip` | status pill, format tag, filter token | status = icon + label, never colour-alone; removable chip has `aria-label="Remove X"` |
| `Toast` | transient confirm/err | `role=status`/`alert`; auto-dismiss pausable; also persists in a log |
| `Skeleton` | loading placeholder | shimmer gated by reduced-motion; `aria-hidden`, container `aria-busy` |
| `EmptyState` | zero-data (production/first-run) | icon + heading + one-line guidance + primary CTA |
| `ErrorState` | load failure | plain cause + **Retry**; never leaks internals (ARCHITECTURE §6) |
| `Rating` | 1–5 stars, read + input | input mode is a radiogroup, keyboard-operable; read mode has `aria-label="4.6 of 5"` |
| `Avatar` | user/provider glyph | `alt` = name or `alt=""` if adjacent to name |
| `ProgressBar` | course/lesson progress | `role=progressbar` + `aria-valuenow/min/max` + visible `%` |
| `Pagination` | catalogue paging | `nav` + `aria-current="page"` |
| `Chart/*` | LineTrend, BarCompare, Donut, Funnel, StatTile, Sparkline | per §9: legend for ≥2 series, direct labels, table-view toggle, tooltip |
| `AppShell` | landmarks, nav, skip-link, brand header/footer, theme toggle, persona badge | the frame every `/app` page renders inside |
| `ClamShell` | yellow clam-shell icon, homepage only | §10 |
| `BrandProvider` | `/api/brand` → wordmark, `<title>`, footer | §2 |
| `ExportMenu` | CSV download + Print/PDF per dashboard | menu button pattern; `aria-haspopup` |

---

## 6. Information architecture & navigation

Two shells, one public, one authenticated. (Routes mirror PLAN §4 `web/src/pages`.)

**Public (marketing + entry) — no session:**
`/` Home (hero, value prop, capabilities, screenshots, social proof, CTA, **clam
shell**) · `/features` · `/pricing` (Starter/Pro/Enterprise, display-only, CTAs →
real sign-up) · `/about` · `/faq` · `/legal` (Terms + Privacy + cookie notice) ·
`/signin` · `/signup` · `/reset`. The public **catalogue** (`/catalog`,
`/catalog/:slug`) is reachable with no session — this *is* the potential-learner
persona's experience.

**Demo entry:** `/app` in `APP_PROFILE=demo` renders **PersonaSwitch** — four large
buttons (Potential learner · Registered learner · Course provider · Platform
owner). A click opens a real seeded session (ARCHITECTURE §3) and lands on that
persona's home. A persistent **persona badge** in the header shows who you are and
offers "Switch persona" back to the chooser. In `production` the same route is the
normal sign-in / first-run setup.

**Authenticated app shell (`/app/*`):** header (brand wordmark · primary nav ·
theme toggle · persona badge/account menu) + left nav on ≥1024px, collapsing to a
top `Tabs`/drawer at ≤1023px. Nav set is **role-scoped**:

- **Learner:** Dashboard · Catalogue · My Learning (player entry) · Calendar ·
  Roadmap · Certificates · Settings.
- **Provider:** Dashboard · My Courses · Feedback · Settings.
- **Owner:** Overview · Quality & Feedback · Attendance & Completion · Testing ·
  Audit · Settings.
- **Potential learner (anonymous):** Catalogue · Course detail · Sign up CTA only.

Server-side RBAC is the source of truth; nav only hides what the role can't reach
(ARCHITECTURE §4). Settings holds the appearance (Light/Dark/System) toggle, data
export/erasure, and consent review (governance, §11).

---

## 7. Screen-by-screen UX (layout + every state)

Each screen lists: **purpose · layout · demo-path content · loading · empty ·
error**. "Empty" is the production/first-run state; on the demo path screens are
populated (principle 2).

### 7.1 Marketing Home — `pages/marketing/Home.tsx`
- **Layout:** sticky slim header; hero (headline from STRATEGY §1 positioning,
  sub, primary CTA "Explore the catalogue" → `/catalog`, secondary "See the demo"
  → `/app`); capabilities row (4 cards: completion-to-credential, four-persona
  oversight, AI roadmap, brandable/deployable); product screenshots strip (real
  dashboard thumbnails); social proof (logos/testimonials placeholder-free —
  seeded quotes attributed to seeded providers); closing CTA; footer with brand
  line + legal links. **Clam shell fixed bottom-right (§10).**
- **Loading:** static page, no data fetch except `/api/brand` (skeleton wordmark).
- **Empty / Error:** brand fetch failure → falls back to "Nigeria Demo" wordmark,
  page still renders (brand is non-blocking).

### 7.2 Pricing — `pages/marketing/Pricing.tsx`
Three tiers (Starter, Pro, Enterprise), monthly sample prices for Starter/Pro,
"Contact sales" for Enterprise, a feature-comparison matrix (table in
`.table-scroll` on mobile), each CTA a **free-trial** button routing into real
sign-up. Display-only; no payment. Comparison checkmarks carry text labels for
screen readers (not a bare ✓ glyph).

### 7.3 Legal — `pages/marketing/Legal.tsx`
Terms + Privacy on one route with in-page anchors; cookie/consent notice banner
component referenced here. Residency statement surfaced (ARCHITECTURE §6).

### 7.4 Auth — `SignIn / SignUp / ResetPassword`
Single-column card, max-width 400px centred. Email + password with inline
validation (FormField). **"Sign in with {provider}"** button shown only when SSO is
configured (PLAN §6) — otherwise hidden, local login still works. Reset flow:
request → "if that email exists we've sent a link" (no account enumeration) →
reset form. Rate-limit feedback is a friendly "too many attempts, try again in a
moment", never a stack trace. Errors: field-level + an `aria-live` summary.

### 7.5 PersonaSwitch — `pages/PersonaSwitch.tsx`
- **Purpose:** the brief's no-login entry. **Layout:** centered grid of four
  large, clearly-labelled buttons (`repeat(auto-fit, minmax(min(100%,15rem),1fr))`
  → 1 column at 375px, 2×2 on tablet, 4-up on desktop), each with an icon, persona
  name, and one line of what you'll see ("Browse the catalogue as a visitor" /
  "Your courses, certificates and roadmap" / "Your course analytics and feedback"
  / "Platform-wide oversight"). A short "This is a demo — pick a role to explore,
  no sign-up needed" note. **Loading:** persona list from
  `/api/auth/demo/personas` → four skeleton buttons. **Error:** retry card.

### 7.6 Catalogue — `pages/catalog/Catalog.tsx` (potential-learner home)
- **Layout:** search bar (debounced) full-width at top; filter rail (domain,
  format, level, sort) as a left column ≥1024px, collapsing into a "Filters"
  Modal/drawer with a result count on mobile; results grid of **course cards**
  (`auto-fit minmax(min(100%,16rem),1fr)`); a "Recommended for you" rail above
  results (personalised when session, popularity when anonymous); Pagination.
- **Course card:** hero thumbnail (`alt` = course title), domain chip, format
  badge (video/reading/quiz/mixed with icon), title, provider, `Rating` (stars +
  numeric), est. minutes, level, "Add to wishlist" (heart toggle,
  `aria-pressed`). Entire card is a link; the wishlist button is a nested button
  with its own label.
- **Loading:** 8 card skeletons + disabled filters. **Empty:** "No courses match
  — clear filters" with a reset button (only reachable by over-filtering; the
  unfiltered catalogue is always populated). **Error:** ErrorState + Retry.

### 7.7 Course detail — `pages/catalog/CourseDetail.tsx`
- **Layout:** two-column ≥1024px (content left, sticky enrol card right),
  single-column stacked below. Header: title, provider, domain, format, level,
  est. time, **aggregate rating** (big number + star + count). Tabs: **Syllabus**
  (lesson list with type icons + durations), **About**, **Reviews**. Enrol card:
  "Enrol" (or "Continue" if enrolled) + "Add to wishlist" + "Share".
- **Reviews tab = the public feedback thread (§8.2):** aggregate score, then each
  review as a thread — learner comment + star, and the provider's reply nested
  beneath, visible to everyone. A disabled "Leave feedback" control explains
  *"Available after you complete this course"* for non-completers (the gate is
  shown, not hidden).
- **Loading:** header skeleton + syllabus skeleton. **Empty reviews:** "No reviews
  yet — be the first to complete and review." **Error:** ErrorState.

### 7.8 Course player — `pages/learn/CoursePlayer.tsx`
- **Layout:** lesson rail (left ≥1024px / top accordion on mobile) listing lessons
  with completion ticks and a `ProgressBar` for the course; main pane renders the
  active lesson by type:
  - **video** — responsive 16:9 player, **captions on by default** (VTT),
    transcript toggle; never autoplays.
  - **reading** — rendered markdown, **"Download" button** for the asset (works
    offline, principle 4), reading-time estimate.
  - **quiz** — inline quiz (radiogroup questions), submit → score.
  - Each lesson has a **"Mark complete"** control; completing the last lesson sets
    the enrollment to `completed` and surfaces the **"Take certification test"**
    and **"Leave feedback"** calls-to-action (now unlocked).
- **Loading:** rail skeleton + player skeleton. **Error:** "Couldn't load this
  lesson — Retry"; video failure degrades to transcript/reading, progress still
  markable. **Resume:** opens at the first incomplete lesson.

### 7.9 Quiz — `pages/learn/Quiz.tsx`
Radiogroup per question (keyboard arrow-navigable), progress "Q 3 of 8", submit →
**score screen**: percent, pass/fail badge (icon + label), per-question review with
the correct option and the stored explanation. Below pass → "Retry" (unlimited in
this build; attempt limits are deferred, PRD §6). Score announced via `aria-live`.

### 7.10 Certification test room — `pages/learn/TestRoom.tsx`
- **Purpose:** the optional step from completed course → certificate. **Layout:**
  a focused, low-chrome "test mode" — a pre-test panel (what it covers, pass mark,
  that passing issues a certificate), **Start**, then one-question-per-view with a
  visible **time remaining** (the `time_limit_min` is shown and enforced
  client+server; hard anti-cheating/lockdown is deferred, PRD §6). On submit:
  pass → **certificate issued** screen (serial, verify link, "Add to my
  certificates", download/print); fail → encouraging retry with a pointer back to
  the weak lessons. **Scheduled** tests appear here and on the calendar.
- **Loading / error:** question skeleton; a submit failure preserves answers and
  offers retry (never silently loses a test).

### 7.11 Learner dashboard — `pages/learner/Dashboard.tsx`
The learner's home and the completion cockpit. **Layout:** a stat-tile row
(Enrolled · Completed · Certificates · Avg score) then cards:
- **Continue learning** — resume rail of in-progress courses with progress bars.
- **Certificates** — recent certs with verify links (→ 7.14).
- **Scheduled exams** — upcoming certification tests with date + "Enter when
  ready".
- **Wishlist** — saved courses, quick-enrol.
- **Roadmap panel** — top 3 roadmap steps + "View full roadmap" (→ 7.13).
- A `LineTrend` of the learner's own activity (lessons completed per week).
- **Loading:** stat skeletons + card skeletons. **Empty (production, new
  learner):** a friendly first-run: "Start by exploring the catalogue" + CTA; the
  roadmap panel invites "Generate my roadmap". **Error:** per-card ErrorState so
  one failed fetch doesn't blank the page.

### 7.12 Calendar — `pages/learner/Calendar.tsx`
Month grid (`role=grid`) spanning **started** (enrolment start), **completed**
(completion date), and **scheduled exams** as distinct, legended, icon+label event
types (not colour-alone). Month nav (prev/next, "Today"), and a list view toggle
that becomes the **default at ≤640px** (a 7-column grid is unreadable at 375px, so
the narrow layout is an agenda list, keyboard-navigable). Click an event → its
course/test. **Empty:** "No activity yet this month." **Error:** ErrorState.

### 7.13 Roadmap — `pages/learner/Roadmap.tsx`
Ordered, numbered path of recommended courses, each with a one-line **reason**
("builds on your SQL completion", "fills a gap in your data domain"). Header states
**"Suggested path — generated from your activity"** (honest framing, never an
outcome claim, STRATEGY §5). **"Regenerate"** button; while running, an
`aria-live` "Building your roadmap…" and skeleton steps. Shows which generator
produced it only as a subtle label if `llm`. **Empty:** "Generate your first
roadmap" CTA. **Error:** "Couldn't build a roadmap right now — Retry" (rules
generator is offline-safe so this is rare).

### 7.14 Certificates — `pages/learner/Certificates.tsx`
Grid of certificate cards (course, issue date, serial, score). Each opens a
**certificate view** (the hero credential — big course name, learner name, brand,
serial, issue date, a **public verify URL / code**). "Download / Print" uses the
print route. The public verify page (`/verify/:serial`, from
`GET /api/certificates/:serial`) shows valid/invalid with issue details and no PII
beyond the holder name shown on the credential. **Empty:** "No certificates yet —
finish a course and pass its test." **Error:** ErrorState.

### 7.15 Feedback form — `pages/learner/FeedbackForm.tsx`
`Rating` (1–5, required) + comment. **Completion-gated:** if the learner has no
`completed` enrollment for the course the form is replaced by an explanatory
EmptyState ("You can review this course once you complete it") and the server
rejects a forged submit with 403 (ARCHITECTURE §9) — the UI never implies it's
allowed. On submit → optimistic thread entry + toast. (Editing submitted feedback
is deferred, PRD §6 — the UI shows it as read-only after submit.)

### 7.16 Provider dashboard — `pages/provider/Dashboard.tsx`
- **Purpose:** the provider's cockpit (wishlist demand, active progress,
  completions, certification funnel). **Layout:** stat-tile row (Wishlist adds ·
  Active learners · Completions · Certificates issued) + per-course table
  (`.table-scroll`): course, wishlist count, active, completed, cert pass-rate,
  avg rating, with a row expander → that course's **certification funnel**
  (`Funnel`: enrolled → completed → test scheduled → test passed → certified) and
  a `BarCompare` of its lessons' drop-off. ExportMenu top-right.
- **Loading:** stat + table skeletons. **Empty (production, no courses):**
  "Publish your first course" CTA. **Error:** ErrorState.

### 7.17 Provider feedback threads — `pages/provider/FeedbackThreads.tsx`
List of learner feedback on the provider's courses, filterable by course and
rating. Each item is a **thread**: learner review + the provider's reply box
(submit → reply appears in the public thread on the course detail, visible to all).
Replying is two clicks. **Empty:** "No feedback yet." **Error:** ErrorState.

### 7.18 Owner dashboard — `pages/owner/Dashboard.tsx` (+ sub-sections)
The closing screen for a buyer (STRATEGY §5) — their future cockpit. Sectioned
(Tabs or anchored): **Quality & feedback** (avg platform rating `LineTrend` over
time, rating distribution, top/bottom courses), **Attendance & completion**
(enrolments vs completions time series, completion-rate `StatTile` + trend,
by-domain `BarCompare`), **Testing** (tests in-progress vs passed, **success-rate**
gauge, certification funnel platform-wide). Stat-tile header row spans the headline
numbers. Everything reads from seeded 18-month history (PLAN §5) so it's populated
on first load. ExportMenu. **Loading/empty/error** as per cards.

### 7.19 Owner audit — `pages/owner/Audit.tsx`
Append-only `audit_log` viewer: who · action · entity · when, filterable, paged, in
`.table-scroll`. Read-only. Governance surface (ARCHITECTURE §6). **Empty:** "No
events in range." **Error:** ErrorState.

### 7.20 Print dashboard — `pages/print/PrintDashboard.tsx`
A print-optimised, single-column, high-contrast render of a dashboard for PDF
export (charts → static, tables → full, no nav/chrome). Reached from ExportMenu →
"Print / PDF".

### 7.21 Setup — `pages/Setup.tsx` (production profile only)
First-run owner/org creation: brand name, owner email + password (`SEED_PASSWORD`
per Forge install), residency. Guided, one screen, validated. Never reachable once
setup is complete.

### 7.22 Settings (all roles)
Appearance (Light/Dark/System segmented control), account, **data export** (GDPR
download) and **delete my data** (confirm Modal, irreversible — clearly stated),
consent review. Role-appropriate only.

---

## 8. The four core flows (journeys with their edge states)

### 8.1 Quiz → certification test → certificate
Catalogue → enrol → player (complete lessons, pass in-lesson quizzes) → on last
lesson complete, enrollment flips to `completed` and the **"Take certification
test"** CTA unlocks → TestRoom (timed) → **pass issues a certificate row** (serial,
verify code) → Certificates + public verify link. **Edge:** fail → retry with a
pointer to weak lessons; a learner can hold the completion without ever taking the
test (the test is optional, PRD). Proven end-to-end against Postgres (PLAN §5,
Phase 4).

### 8.2 Completion-gated feedback + provider reply thread
Only a learner with a `completed` enrollment sees an enabled feedback form (§7.15);
others see the gate explained and are blocked server-side (403). A submitted
review posts to the **public thread** on the course detail with the aggregate score
updated. The **provider replies** (§7.17); the reply renders in the same thread,
**visible to all users** (potential learners included) as a conversation between
that learner and that provider. (Edits deferred, PRD §6.)

### 8.3 AI learning roadmap
From the learner dashboard or Roadmap page → "Generate" → ordered path with
per-step reasons, framed as a *suggested* path (§7.13). Default generator is
deterministic + offline (ARCHITECTURE §7); optional LLM when configured.
"Regenerate" re-runs. `aria-live` announces progress and completion.

### 8.4 Wishlist + calendar
Add to wishlist from a card or course detail (`aria-pressed` heart) → appears on
the learner dashboard and the **calendar** alongside started/completed/scheduled
events (§7.12). Remove from either place. The calendar is the single view spanning
all of a learner's activity across time.

---

## 9. Data visualization specification (per the dataviz method)

Built with the Recharts wrappers in `web/src/components/Chart/*` (PLAN §4),
parameterised by the validated palette below. Chart colour is **independent of the
brand accent** so brandability never breaks colourblind-safety.

**Form by job** (dataviz step 1):
- **Headline magnitude** → `StatTile` (hero number + label + delta, no plot). Used
  for completion rate, certificates issued, wishlist adds, test success rate.
- **Change over time** → `LineTrend` (enrolments/completions per week/month,
  platform rating trend, learner activity). One y-axis, crosshair + tooltip.
- **Compare categories** → `BarCompare` (completion by domain, per-course metrics,
  lesson drop-off). Thin bars, 4px rounded data-ends, 2px surface gap.
- **Part-to-whole** → `Donut` (rating distribution, format mix) — only when parts
  are few; otherwise a bar.
- **Stage drop-off** → `Funnel` (certification funnel: enrolled → completed →
  scheduled → passed → certified) — the signature provider/owner chart.
- **Inline trend** → `Sparkline` in table rows / stat tiles.

**Categorical palette (validated this stage, both modes):** slots in fixed order —
blue `#2a78d6` / orange `#eb6834` / aqua `#1baf7a` / yellow `#eda100` / magenta
`#e87ba4` / green `#008300` / violet `#6250d6` / red `#e34948` (dark steps:
`#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 #e66767`). Validator
result: **all checks pass** in both modes (worst adjacent CVD ΔE 9.1 light / 8.4
dark; normal-vision ΔE 19.6 / 19.3). Assigned in fixed order, never cycled; a 9th
series folds to "Other" or small multiples. Scatter/bubble/all-pairs forms cap at
**three** slots (the all-pairs floor), which none of our charts exceed.

**Relief rule (the light-mode WARN):** aqua, yellow, and magenta sit below 3:1 on
the light surface, so every categorical chart ships **direct value labels and a
table-view toggle** (and identity is never colour-alone — legend for ≥2 series,
≤4 also direct-labelled). This doubles as the export-friendly and
screen-reader-friendly path.

**Sequential** = blue single-hue ramp (magnitude heatmaps if any). **Diverging** =
blue↔red with a neutral gray midpoint (e.g. above/below target completion).
**Status** = good `#0ca30c` / warning `#fab219` / serious `#ec835a` / critical
`#d03b3b`, **always with icon + label**, reserved — never reused as a series hue.

**Interaction & a11y (dataviz steps 5–6):** line/area carry a crosshair + tooltip;
bar/dot/cell carry per-mark hover tooltips; filters sit in one row above the
charts; every chart has a **table view** and dark mode is a selected set of steps
(above), not an auto-flip. Texture fill is available for `forced-colors`/print.

**Export:** CSV endpoints per dashboard + the print route (§7.20); the table view
is what the CSV mirrors, so exported data matches the chart exactly (PLAN §3).

---

## 10. The clam shell (brief requirement)

`web/src/components/ClamShell.tsx`. A **yellow clam-shell icon fixed in the
bottom-right corner of the homepage** (`/`) only — not in the app shell. Spec:
- Inline SVG, fill `--clamshell` (`#f5c518`), a dark glyph/outline `#16181d`
  (10.9:1, well above AA) so it's visible in both themes.
- `position: fixed; right: 16px; bottom: 16px; z-index above content but below
  modals`; 44×44px tap target; respects safe-area insets on mobile.
- It is a focusable **button** with `aria-label="Cognivo"` (a small brand easter
  egg / scroll-to-top affordance), visible focus ring, keyboard-activatable. It
  never overlaps the primary CTA at 375px (anchored to the corner, content has
  bottom padding so nothing is occluded).
- Decorative-but-labelled: it carries an accessible name rather than being
  `aria-hidden`, because it is interactive.

---

## 11. Microcopy, errors, and governance surfaces

- **Error messages** help the user and never leak internals (ARCHITECTURE §6):
  pattern = *what happened · why (plain) · what to do*. "We couldn't save your
  feedback just now. Check your connection and try again." No stack traces, no DB
  errors, no IDs.
- **Empty states** teach the next action, never a dead end.
- **Destructive actions** (delete my data, delete account) use a confirm Modal
  stating irreversibility; the primary button is `danger` and labelled with the
  specific action ("Delete my data"), not "OK".
- **Consent:** a cookie/consent notice renders until acknowledged (stored in
  `consents`); Privacy + Terms linked from footer and the notice. Residency stated
  in Settings/owner area.
- **No PII in URLs** (verify links use an opaque serial/code, not emails).

---

## 12. Responsive strategy & why the wireframe passes the gate

**Breakpoints:** base (≤639, designed at 375) · `md` ≥640 · `lg` ≥1024 · `xl`
≥1280. Mobile-first: the base layout is single-column and complete; `min-width`
media queries *add* columns and the left nav. Nothing wider than 375 is pinned
outside a media query.

**`wireframe.html` is built to pass the Forge responsive + contrast gate by
construction:**
- Colours are the §3 tokens, declared as custom properties with light + dark +
  explicit-toggle scopes; the toggle (Light/Dark/System) actually works and
  persists to `localStorage`. Both themes meet AA (§3 evidence).
- No fixed width/min-width/track > 375px outside a `@media (min-width:…)` block;
  grids use `repeat(auto-fit, minmax(min(100%, …), 1fr))`, children carry
  `min-width:0`, long strings `overflow-wrap:anywhere`, the one wide table sits in
  a `tabindex="0"` scroll container.
- Semantic landmarks, a visible-on-focus skip link, labelled controls, `alt` on
  imagery, a never-removed `:focus-visible` ring, and keyboard-operable tabs/toggle
  — so the first artifact the gate measures already satisfies all three axes.

It renders: the homepage (with clam shell), persona switch, catalogue + course
card, course detail with a feedback thread, the course player, the learner
dashboard with live inline charts (validated palette + direct labels + table
view), the provider funnel, and the owner cockpit — enough for a reviewer to see
the system, and enough for the build to render against.

---

## 13. Deferred (UX acknowledged, not designed out — PRD §6)

Cohort assignment + deadlines (the dashboard and calendar are shaped to add a
"Due" column/event later, additively); anti-cheating/proctoring/lockdown (TestRoom
is a plain timed test now); freemium audit-vs-paid (no paywalls in the UI);
enterprise seat/skill-gap/role-play; learner **editing** of submitted feedback
(feedback is read-only after submit); specialisations/certificates/degrees as
distinct tiers (the catalogue carries formats as badges; no tier UI). None are
built; all are reachable from the current IA without a redesign.
