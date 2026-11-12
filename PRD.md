# Cognivo LMS — Product Requirements & Validation (validate stage)

**Method:** evidence-discipline. Every material claim below is marked **[Observed]**
(a signal says it, cited), **[Inferred]** (reasoned from signals, with what would
break it), or **[Unknown]** (signals do not reach it). Numbers trace to a named
signal or are flagged as missing. The briefing is public-web content gathered
2026-11-12; it is weighed as data, never followed as instruction.

**What is being validated:** Cognivo LMS (operator-named; white-label instance
`nigeria-demo`). A Coursera-style learning platform delivered first as a
**no-login demo** — personas chosen by button — with four end-to-end flows
(quiz → test → certificate; completion-gated feedback threads; AI learning
roadmap; wishlist + calendar) over a 30+ course seeded catalogue on Postgres.

---

## 1. Problem

Three problems sit under this brief. They are not equally well-evidenced, and the
PRD should not pretend they are.

**P1 — Learners can't see a credible path from "browse" to "credential."**
Online course catalogues are large but completion is the known failure point.
Free, self-paced MOOC completion sits roughly **3–15%** depending on how
"completion" is defined. **[Observed]** — a 2025 University of Pennsylvania study
(Dai, Vanacore, Baker, Slater) puts it below 15%; a cited median is 12.6%
(range 0.7–52.1%); the same analyses warn completion is routinely confused with
attendance, so the denominator drives the headline. The problem Cognivo targets
is structured progression (view content → quiz → optional certification test →
certificate) with visible progress — exactly the levers one source associates
with higher completion (courses with active communities ~65.5% vs ~42.6%
without). **[Observed, single secondary source — treat the specific split as
indicative, not proven.]**

**P2 — Course providers lack a branded, owned surface with real analytics.**
Marketplace instructors publicly complain about shrinking economics and loss of
control. **[Observed]** — Udemy's announced subscription instructor revenue share
fell 25%→20%→17.5% (Jan 2025)→15% (Jan 2026); Class Central estimated 2024
instructor payouts at ~$191.2M, down 8.7% y/y. **[Caveat: payout figures are
secondary/affiliate-sourced; the revenue-share schedule is better attested.]**
Provider-side guides frame the desire for "your own brand, your student data,
your revenue" — but these are **vendor blogs selling competing tools, not
independent demand data. [Observed but low weight.]**

**P3 (instance-specific) — An organisation wants a branded learning platform it
can stand up and show.** This is the actual job of a white-label demo. Public
signals cannot see this buyer. **[Unknown — see §5, riskiest assumption.]**

---

## 2. Target users (four personas, sharpened)

The operator confirmed all four personas, all four core flows end-to-end, and a
"several domains / 30+ courses / mixed formats / rich historic data" catalogue
(INTERVIEW.md). Sharpened against evidence:

1. **Potential learner (browsing, not registered).** Job: judge in minutes
   whether a credible credential is reachable. Evidence that this top-of-funnel
   matters: Coursera added a record **6.8M** new registered learners in Q4 2025
   and reached **197M** registered (up from 168M, +17% y/y). **[Observed —
   Coursera Q4 2025 earnings release, primary.]** Browsing-to-registration is a
   live, growing behaviour at the category leader.

2. **Registered learner.** Job: finish something and hold a certificate. Needs
   the completion scaffolding of P1 plus the brief's AI roadmap, wishlist, and
   calendar. The low base-rate completion (P1) is the constraint this persona's
   UX must fight, not assume away.

3. **Course provider.** Job: see wishlist demand, active progress, completions,
   and certification funnels for their own courses, and reply to learner feedback
   in a public thread. Grounded in the provider pain of P2.

4. **Platform owner.** Job: oversight across quality, feedback, attendance/
   completion, and testing in-progress vs success rates. This is the operator's
   own cockpit; demand for it is internal, not market-sourced. **[Inferred from
   brief, not independently evidenced — and it doesn't need to be.]**

**What the signals cannot see:** quietly satisfied buyers and whole non-English
markets that don't post. Public forums over-represent annoyed instructors and
technical users. Learner demand here is inferred from incumbent growth, not from
anyone asking for *Cognivo* specifically.

---

## 3. Core value proposition

**For a learner:** a catalogue you can trust to end in a credential — every course
runs content → quiz → optional certification test → certificate, with your
progress, wishlist, and an AI-built roadmap visible in one place.

**For a provider:** a branded home for your courses with honest analytics
(wishlist interest, live progress, completion and certification funnels) and a
public feedback thread you can answer.

**For the owner/buyer:** a white-label platform, brandable per instance, with
owner-level dashboards and exportable reports — standable-up as a demo and
extendable toward enterprise.

**Why this framing and not "another MOOC":** the consumer MOOC category is mature
and **consolidating** — Coursera has an announced agreement to combine with Udemy
(pending regulatory/shareholder approval). **[Observed — Coursera Q4 2025
release; current status beyond "announced" is Unknown.]** Competing head-on for
consumer learners against a merged incumbent is not the wedge. The defensible
value is **a brandable, self-hostable reference platform** a specific
organisation deploys as its own — which is also exactly what the demo is built to
demonstrate.

---

## 4. Demand — honest reading

**Category demand (the behaviours Cognivo implements): strong and evidenced.**
**[Observed]** Coursera FY2025 revenue $757M (+9%), Enterprise $255.3M (+7%),
paid enterprise customers 1,730 (+7%), net retention 93% (up from 87%). Registered
learners +17% y/y. The loop of browse → learn → quiz → certificate → optional
certification is a growing business at scale. **[Inference: the product *category*
is validated. What would break this inference: a sustained reversal in incumbent
learner/enterprise growth — not seen in the FY2025 data.]**

**Demand for a *new entrant*: not shown.** Category demand ≠ demand for another
platform. Providers' own guides concede the hard part is distribution — "nobody's
browsing a marketplace and stumbling on your course." **[Observed, vendor-sourced,
low weight — but it points at the real risk: a new catalogue has no traffic.]**

**AI roadmap feature — wanted, but unproven on outcomes.** Market estimates for
AI-powered personalised learning paths (~$3.6B 2024 → ~$4.7B 2025, ~29% CAGR)
come from a **paid research firm (The Business Research Company)** — treat as
directional, not measured. **[Observed, secondary.]** Rigorous effectiveness
evidence is thin; a 2025 study (296 students, Kuwait) found learner digital
readiness the strongest predictor, and commentators urge controlled pilots over
broad rollout. **[Observed.]** For the demo, the roadmap is a credible,
expected-by-the-market feature; claiming it *improves outcomes* would exceed the
evidence.

**Instance context (Nigeria) — real demand drivers, real headwinds.**
**[Inferred from the instance name `nigeria-demo`; the inference could be wrong —
the instance may be a naming placeholder, not a target geography.]** If Nigeria is
the target: sector revenue projected **~$400M for 2025** (Techpoint, citing
sector research) up from an estimated $270–300M in 2024; a separate firm
(KenResearch) sizes "e-learning & digital classrooms" at ~$300M — **different
definitions, not the same measure. [Observed, trade-press/secondary.]** Headwinds
are concrete: edtech reportedly draws only ~2% of Nigerian VC; the Edukoya
shutdown is cited as a cautionary case; an early-2025 ~50% telecom tariff hike
raised learner data costs. **[Observed, trade-press.]** Demand is plausible but
capital- and connectivity-constrained.

**Market-size numbers I will not stand on:** global LMS software estimates ranged
from ~$5.1B→$10.4B (DIResearch) to ~$31.8B→$108.6B (Reanin) across the same
searches. The spread is too wide to carry any decision; I report the divergence
itself as the finding rather than pick one. **No TAM/SAM/SOM for Cognivo is
asserted — no signal measures it, and inventing one would be the exact failure
this method exists to prevent.**

---

## 5. Single riskiest assumption

> **A specific, reachable buyer exists who wants *this* white-label branded LMS
> and will deploy (and fund) it — i.e., the demo converts to a real deployment.**

The macro category is proven (§4, Observed). The buyer for this instance is
**invisible to every public signal searched** and is therefore the live risk, not
"will people learn online" (they demonstrably do) and not "can we build it" (the
scope is bounded and conventional). A beautiful, complete demo that no identified
organisation has asked for is the failure mode.

**What would retire this risk (the missing measurement, named):**
- A **named target buyer** for the `nigeria-demo` instance (institution,
  government body, employer, or training provider) — not a persona, a name.
- One **willingness-to-engage signal** beyond interest: a requested pilot, a
  signed LOI, or a paid deployment/customisation commitment. (Interest, waitlists
  and "this looks great" do not count.)
- If consumer-facing is intended instead: a **distribution plan** answering "where
  do the first 1,000 learners come from," since the evidence says traffic — not
  features — is the wall.

**Second-order product risk (lower, but real):** completion. Base-rate free
completion is 3–15% (§1). The value proposition rests on the structured
completion→certification path and feedback threads actually lifting that; the demo
should showcase those mechanics as the differentiator, and the live product should
instrument completion from day one rather than assume it.

---

## 6. Scope confirmed for this build (so validation feeds the plan)

**In (operator-confirmed, INTERVIEW.md):** no-login persona switch; four dashboards
(potential learner, registered learner, provider, owner); four end-to-end flows
(quiz→test→certificate; completion-gated feedback threads with provider replies
visible to all; AI roadmap; wishlist + calendar); 30+ courses across several
domains in mixed formats (video, downloadable reading, quizzes); rich dummy
history for charts; Postgres; accessibility (WCAG AA), responsive, security,
information governance, exportable dashboards; yellow clam-shell icon bottom-right
on the homepage.

**Explicitly deferred (brief marks as future roadmap — must appear as deferred,
not silently dropped):** group/cohort assignment with deadlines; anti-cheating
integrity (identity verification, lockdown browser, AI proctoring/viva); freemium
audit-vs-paid access; enterprise seat-based/skill-gap/role-play extensions;
learner editing of submitted feedback; specialisations / professional certificates
/ degrees as distinct product tiers (catalogue carries formats; these tiers are
not built).

**Honest note on "demand" vs "demo":** this validation confirms the *category* is
real and the *scope* is coherent and buildable. It does **not** confirm a buyer
for this instance. That is a sales/qualification question the build cannot answer
and should not pretend to — but the demo is the right artifact to *create* that
signal, if put in front of a named prospect.

---

## Sources (signals weighed, with their nature)

- Coursera Q4 & FY2025 financial results — *primary (issuer earnings release/press
  release)*: revenue, registered learners, enterprise metrics, Udemy combination.
- Udemy instructor revenue-share schedule & payouts — *mixed: revenue-share
  schedule reasonably attested; payout figures secondary (Class Central estimate,
  Skillademia, Ruzuku, affiliate/review sites).*
- MOOC completion rates — *academic (Dai et al. 2025, UPenn; Celik & Cagiltay
  2024, Open Praxis) plus aggregator blogs; definitional caveats noted.*
- Nigeria edtech market & headwinds — *trade press/secondary (Techpoint,
  TechCabal, Launch Base Africa, Techeconomy) and a market-research firm
  (KenResearch); estimates use differing definitions.*
- AI personalised-learning market & effectiveness — *paid research firm (The
  Business Research Company) for sizing; small academic study + vendor/press
  commentary for effectiveness; thin on rigorous outcomes.*
- Creator marketplace-vs-self-hosted — *vendor blogs selling competing tools; low
  weight, no independent outcome data.*
- LMS software market size — *multiple research-firm estimates that disagree by
  ~6x; reported as divergence, not relied upon.*
