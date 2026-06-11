## Context

The Rehearse.io platform consists of three services: Express.js backend (port 9000), React frontend (port 5173), and FastAPI AI service (port 8000). A comprehensive audit revealed several bugs across all three services — most critically, the AI evaluation pipeline has a data persistence gap where scores and feedback are computed by the AI service, returned to the frontend, but never saved to the database.

The current data flow for candidate interviews is:

1. Backend `POST /api/interviews/candidate/evaluate` → proxies audio to AI service → returns `{ score, feedback, transcription }` → **NOT saved to DB**
2. Backend `POST /api/interviews/candidate/submit` → stores `transcription` only (explicitly ignores `score`/`feedback` from client body per design intent comment)

This pits two intended designs against each other: "score/feedback must come from server, not client" and "score/feedback is never persisted by the server". The result is data loss.

The AccountSettings page calls the same `/api/auth/onboard` endpoint for photo and voice updates that is designed for full-profile onboarding with a mandatory `resume` field. This makes those features non-functional.

## Goals / Non-Goals

**Goals:**
- Persist AI-generated scores and feedback to CandidateInvite results in the database
- Fix AccountSettings photo and voice save to work without requiring a resume upload
- Fix race condition in concurrent answer submissions
- Add `authorize("candidate")` to candidate-specific API routes
- Fix Content-Type header on FormData audio upload to AI service
- Stop TTS before starting recording in RehearsalRoom
- Add proper error handling to silent `.catch( () => {} )` handlers
- Clean up misleading payload fields in frontend submit calls

**Non-Goals:**
- No new features or capabilities beyond bug fixes
- No refactoring of existing working logic (unless it directly relates to a bug)
- No addition of automated tests (out of scope for this change)
- No architectural changes to the service communication pattern

## Decisions

### Decision 1: Save AI evaluation results directly in the evaluate endpoint

**Option A** (chosen): Save score/feedback/transcription directly in the `/candidate/evaluate` endpoint (reuse `evaluateAnswer` from rehearsalController or create a dedicated interview evaluateAnswer that also persists).
**Option B**: Have the evaluate endpoint return a result ID that submit uses to look up the persisted evaluation.
**Option C**: Have submit pass back the transcription only and re-evaluate server-side.

**Why A**: Simplest approach — the evaluate endpoint proxies to the AI service and receives the complete result. Saving inline is one DB write with no additional architecture. Option B adds an unnecessary indirection layer. Option C doubles AI service costs by re-evaluating.

**Implementation**: Create a new `evaluateAndSubmitAnswer` controller in `interviewSessionController.js` that calls the AI service and saves results in one atomic operation. Alternatively, modify the existing route to persist the result after receiving it from the AI service, and have the `/candidate/submit` endpoint merely update the submission status.

**Refined approach**: The evaluate endpoint (`POST /candidate/evaluate`) already receives the audio + question and returns score/feedback/transcription. We add a DB save step here: after the AI service responds, save the result to `CandidateInvite.results` for the current candidate's active invite (identified by JWT user). The `/candidate/submit` endpoint then only handles finalization (completion check). This avoids the two-step gap.

### Decision 2: Fix AccountSettings photo/voice save with a dedicated PATCH endpoint

**Option A** (chosen): Add a new `PATCH /api/auth/profile` endpoint that accepts partial profile updates (photo, audio fields independently) without requiring resume.
**Option B**: Modify the `onboard` endpoint to allow optional resume when the user is already onboarded.
**Option C**: Create separate `/api/auth/photo` and `/api/auth/audio` endpoints.

**Why A**: A single PATCH profile endpoint follows REST conventions for partial updates, is simpler than two separate endpoints, and avoids complicating the onboard flow with conditional logic. The onboard endpoint's resume-required check is intentionally strict for new users.

**Implementation**: New controller `updateProfile` in `authController.js` that accepts `{ photo?, audio? }` and uses `$set` to update only provided fields (not `$set` with undefined values). Validate each base64 field independently. Add route `PATCH /api/auth/profile` in `authRoutes` after the auth limiter.

### Decision 3: Fix submitAllResults race condition with sequential submission

**Option A** (chosen): Replace `Promise.allSettled` with sequential `for...of` loop to guarantee ordered, non-overlapping submissions.
**Option B**: Keep concurrent submission but add server-side deduplication with a transaction.
**Option C**: Send all results in a single batch request.

**Why A**: Simplest and most reliable. With sequential submission, the `existingIndex` check works correctly and completion detection is accurate. The overhead is negligible (3-10 sequential POSTs vs concurrent). Option B is complex and fragile. Option C requires a new endpoint.

### Decision 4: Fix FormData Content-Type for AI service upload

Remove the manual `Content-Type` header from the axios request to the AI service in `evaluateAnswer`. Axios automatically sets the correct `multipart/form-data` header with the boundary parameter when the body is a FormData instance. Setting it manually strips the boundary.

### Decision 5: Add authorize("candidate") to candidate routes

Simply add `authorize("candidate")` middleware after `protect` and `requireOnboarded` on the three candidate routes in `interviewSession.js`. The `getMyInterviews` route already has `protect` but no role check. The `evaluate` and `submit` routes have `protect, requireOnboarded` but no role check. Note: The submit controller has an ownership check that effectively protects it, but explicit middleware provides defense-in-depth and clearer intent for route readers.

### Decision 6: Stop TTS before recording in RehearsalRoom

Add `if (speaking) stop();` at the start of `handleToggleRecording` in `RehearsalRoom.tsx`, matching the pattern already used in `CandidateInterview.tsx:121`.

### Decision 7: Handle silent .catch() handlers

Replace `.catch(() => {})` with `.catch((err) => console.error("...", err))` in:
- `InterviewSetup.tsx:28` — org fetch error
- `AccountSettings.tsx:68` — consent fetch error

This surfaces errors in devtools without breaking the UX (the components already have empty-state fallbacks: empty dropdown, default consent state).

## Risks / Trade-offs

- **[Persistence change for evaluate]** The evaluate endpoint currently returns results without waiting for a DB write. Adding a DB write increases response latency by 5-20ms. This is negligible compared to the AI service latency (1-5 seconds).
- **[Sequential submission]** Replacing `Promise.allSettled` with sequential loops increases total submission time from ~100ms to ~300-500ms for 5 questions on a fast connection. The user already sees a "Submitting..." loading state, so this is not noticeable.
- **[PATCH /api/auth/profile]** Adding a new endpoint means the front-end AccountSettings code needs to be updated to call the correct endpoint. This increases the diff but is necessary to avoid the broken behavior.
- **[authorize("candidate") on routes]** Requires that candidate JWT tokens have the `candidate` role. This is already true for candidates created via signup. For auto-created candidates (from recruiter invites), the `generateInvite` function creates them with `role: "candidate"`, so no issue.
- **[AccountSettings cleanup not covered]** The `useEffect` cleanup in AccountSettings (line 206-211) has the same stale-closure issue as the Onboarding cleanup (dependent on stream/isRecording state at effect creation time). This is a pre-existing pattern and fixing it would require significant refactoring. Not included in this change.

## Migration Plan

All changes are backwards-compatible bug fixes — no schema migrations, no breaking API changes:
1. Apply changes in dependency order: backend schema-independent fixes first, then frontend changes
2. Verify candidate interview flow manually (create interview → invite → accept → record → evaluate → submit → verify DB has score/feedback)
3. Verify AccountSettings photo/voice save works
4. Verify recruiters cannot access candidate routes
