# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, deliberately served as **one loop**: when a design decision pits
them against each other, neither wins by default — the cost to the other side is
the deciding evidence.

- **Recruiters and hiring managers** at companies screening first rounds at
  volume. They build an interview, send invite links, and review per-candidate
  results. Professional, high-stakes, evaluation-focused. They are also the
  buyer.
- **Candidates**, in two distinct situations: *invited* candidates who complete
  an async interview on their own schedule with an invite link as their only
  credential until they sign in, and *self-serve* candidates who sign up to
  practise voice and DSA rounds against the same scoring.
- **Organizations** of multiple recruiters, who share interviews and invite
  members.

## Product Purpose

An enterprise platform for running first-round and multi-round interviews. It
automates, streamlines, and analyzes the process so companies can evaluate
candidates consistently and at scale.

Success looks like: a recruiter builds a session in minutes, candidates
complete their rounds on their own schedule, and every submission comes back
with scores that can be compared across candidates.

## Positioning

**The same rubric for every candidate.** Every answer and every code submission
is scored against one AI rubric, so candidates are compared on identical
dimensions instead of on interviewer-to-interviewer variance. Fairness and
consistency are the claim, and they are the thing a neighbouring point tool
cannot truthfully copy: coding-only and video-only tools either cover half the
round or leave the judgement to a human reviewer.

Supporting capability, not the claim itself: behavioral voice and DSA coding
live in one async invite with multi-round progression.

## Operating Context

**Recruiter flow.** Sign in via the shared auth service → create or join an
organization → build an interview (behavioral, DSA-only, or mixed; DSA
difficulty easy / medium / hard / mixed) → invite candidates → review
per-candidate behavioral and DSA breakdowns.

**Invited candidate flow.** Open the invite link (a public route; the token is
the only credential before sign-in) → complete rounds in order
(behavioral → DSA → done) → each round's result is recorded as it is submitted.

**Self-serve candidate flow.** Onboard → practise a behavioral rehearsal or a
DSA problem → see past sessions on a dashboard.

**Environment.** Browser, desktop-oriented. The behavioral round needs a
microphone; the DSA round is solved in an in-page code editor with a language
choice.

**Scoring artifacts.** Behavioral returns a 1–10 score plus written feedback.
DSA returns an overall score plus correctness and codeQuality.

**Compliance surface.** Consent versioning, GDPR data export, and soft-delete
account deletion are part of the product, not an add-on.

**Auth.** Delegated to a shared Better Auth service (`auth.shrijit.tech`).
There is no local password login and the app never stores passwords.

## Capabilities and Constraints

**Capabilities.** Candidate practice (voice rehearsal + DSA coding practice with
AI scoring); recruiter interviews (behavioral / DSA-only / mixed); shareable
invite links with multi-round progress; AI evaluation (spoken answers
transcribed and scored over a Gemini Live session; static LLM review for
code); per-candidate results dashboards; multi-recruiter organizations; consent +
GDPR export + soft delete; a write-only audit log of security events with no
viewer yet; **a candidate-maintained profile** — the record of what the
platform holds (resume, headshot, voice sample) and the structured profile a
practice round is generated from (headline, location, skills, roles,
qualifications), readable and editable at `/profile`.

**Constraints that future work must preserve.**

- **Code is evaluated by static LLM review — there is no sandbox and no
  execution.** Scores are model judgement, not test-case results, and no surface
  may imply otherwise.
- **AI features depend on explicit provider config, and none of it is set in
  production.** Spoken sessions run on the Gemini Live API (`GEMINI_API_KEY`);
  text inference (scenario generation, DSA) runs on any OpenAI-compatible
  endpoint named by `LLM_BASE_URL`/`LLM_MODEL`. Missing config makes the
  affected endpoints return honest 503s.
- **A resume must be a valid PDF or rehearsal start fails.** Resumes, photos,
  and audio are stored base64 in Postgres, encrypted when `ENCRYPTION_KEY` is
  set; S3 is not wired up.
- **The candidate's display name is owned by the shared auth service.** Every
  session rebuilds the local row from it, so a name edit must be written there
  first or it is reverted at the next sign-in.
- **The structured profile is the candidate's record, not the model's.** The
  resume read only ever *proposes*: it writes nothing until the candidate
  accepts specific sections, and a re-read must never silently replace a
  correction. What a practice round reads is the corrected profile when there is
  one, and the raw PDF text only as the fallback.
- **The interview invite token is a 2-day JWT** and the candidate's only
  credential before sign-in. Raw invite tokens are shown once and stored
  sha256-hashed.
- **The frontend is a static SPA** — no server rendering — and `VITE_API_URL` is
  baked at build time, so an unset value silently ships a localhost API.
- **No unit tests.** The end-to-end suite needs a running server and a migrated
  database.

**Explicitly undecided.** Pricing and billing model; whether rounds ever run
live or proctored (the product is async-only in code today); whether code
evaluation ever gains real execution; a path for a candidate with no working
microphone.

## Brand Commitments

- **Name:** Rehearse.io. There is no logo or wordmark — the name set in type is
  the only brand mark, and future work should not go looking for one.
- **Voice and personality** (confirmed, preserved): professional, clear,
  unbiased. Confidence and fairness; a reliable enterprise tool rather than a
  playful consumer app.
- **Binding anti-references** (user-stated):
  - No overly playful, gamified, or "bouncy" UI (e.g. Duolingo).
  - No dark-pattern high-pressure countdown timers that induce unnecessary
    anxiety.
  - No saturated SaaS cliché "startup cream/sand" backgrounds.
- **The `rehearse.io` domain is not this project's** — it is a parked GoDaddy
  domain for sale. Live real estate is `rehearse.io.shrijit.tech` (frontend) and
  `api.rehearseio.triptribe.info` (API).

## Evidence on Hand

- One real image asset: `frontend/src/assets/hero-section-image.png`. The rest
  of `frontend/src/assets/` and `frontend/public/` is framework scaffolding
  (`react.svg`, `vite.svg`). The image is currently **unreferenced** — the sign
  world uses no photography — but it is the only real asset and is kept on disk.
- Landing copy that exists and is current: `frontend/src/components/HeroSection.tsx`
  ("Structured first rounds, scored on one rubric.").
- **No customers, no pilot partners, no testimonials, no usage data, no
  benchmarks, and no pricing.** The product is deployed and live but
  unpiloted. Future work must not invent social proof, logos, metrics, named
  customers, or quotes.
- **Invented content found and removed (do not reintroduce):** the landing hero
  carried a free-trial and "no credit card / no fees" claim, a fabricated
  shopping-list scorecard, and a decimal score; `SignUp.tsx` carried a
  testimonial attributed to a named person at a named company with a statistic
  ("cut our first-round screening time by 60%"); the cookie banner offered
  Analytics and Marketing toggles for dependencies that do not exist, and
  `PrivacyPolicy.tsx` asserted analytics and marketing cookies as fact. None of
  these had a source. The banner is now an honest storage notice, and the policy
  describes the auth session cookie and the cached session only.
- Any example session, score, or candidate shown in design work must come from
  real sessions the owner supplies (anonymised as needed) or be obviously
  synthetic placeholder content.

## Product Principles

1. **Consistency is the product.** The same rubric, states, and affordances for
   every candidate. A surface that would make scoring or the experience differ
   between candidates is a defect, not a nuance.
2. **Recruiter and candidate are one loop.** A change to either side is judged
   by what it costs the other.
3. **Clarity over cleverness.** The interface exists to be read and completed
   without distraction.
4. **Respect the candidate.** Interviews are stressful; provide clear
   affordances, calm interactions, and explicit states instead of manufactured
   pressure.
5. **Report system truth.** When a dependency is down, say so plainly — the
   codebase already answers with honest 503s and false health flags rather than
   faking a result.

## Accessibility & Inclusion

High priority, **WCAG AA**, and mandatory rather than aspirational: this is an
employment tool, so clear contrast, screen-reader support, and keyboard
navigation are part of equitable candidate evaluation.

The DSA round's code editor and the behavioral round's audio capture are the two
places where keyboard-only and no-microphone candidates can be shut out; both
need an explicit accessible path. The no-microphone case is currently undecided
(see Capabilities and Constraints).
