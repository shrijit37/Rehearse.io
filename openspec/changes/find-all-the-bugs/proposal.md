## Why

A comprehensive bug hunt across the Rehearse.io codebase has uncovered multiple bugs — some critical — in the AI evaluation pipeline, data persistence, account management, audio streaming, and error handling. These bugs cause data loss (AI scores never saved to DB), broken features (photo/voice upload in AccountSettings), security gaps (missing authorization on candidate routes), and poor UX (silently swallowed errors, race conditions). Fixing these now prevents user-facing failures and data integrity issues as the platform scales.

## What Changes

### Critical Bugs
- **AI evaluation results (score + feedback) are NEVER persisted to the database**: The `/candidate/evaluate` endpoint returns score/feedback to the frontend but does not save to DB. The subsequent `/candidate/submit` endpoint explicitly ignores score/feedback from the client body. AI-generated evaluations shown to the user in the UI are lost on refresh.
- **AccountSettings photo and voice save is broken and destructive**: `handleSavePhoto` and `handleSaveVoice` in `AccountSettings.tsx` send `{ photo }` or `{ audio }` to the `/api/auth/onboard` endpoint, which requires `resume` and returns 400 if missing. Even if resume validation were bypassed, the `findByIdAndUpdate` would overwrite `resume`, `resumeName`, and other fields with `undefined`, deleting the user's uploaded resume.

### High Severity
- **Race condition in `submitAllResults`**: Uses `Promise.allSettled` to submit all answers concurrently. Each request independently checks whether a result exists for its question and creates a new entry. With concurrent requests, multiple results for different questions are appended simultaneously, but the completion check (`invite.results.length >= interview.questions.length`) races — if two results land in the same tick, the check could fire early with partial data. Additionally, since results are pushed in order of network completion rather than question index, the array ordering is unpredictable.
- **Candidate API routes missing role authorization**: Routes `GET /candidate/my-interviews`, `POST /candidate/evaluate`, and `POST /candidate/submit` do not include `authorize("candidate")`. Any authenticated user (including recruiters) could potentially access these endpoints. The `submitAnswer` controller does check `invite.candidate` ownership, providing some protection, but defense-in-depth is missing.
- **`Content-Type` header incorrectly set on FormData audio upload**: The `evaluateAnswer` call to AI service manually sets `"Content-Type": "multipart/form-data"` with axios (rehearsalController.js:87). Axios generates a boundary parameter automatically when FormData is used; manually setting Content-Type strips the boundary, causing the upload to be rejected by the AI service.

### Medium Severity
- **TTS not stopped when recording starts in RehearsalRoom**: `handleToggleRecording` in `RehearsalRoom.tsx` does not call `stop()` on active speech synthesis. If the user is listening to a question spoken aloud and starts recording, audio plays over the recording.
- **`InterviewSetup` silently swallows org fetch errors**: The `.catch(() => {})` on the org fetch (InterviewSetup.tsx:28) silently hides network errors. Users see an empty dropdown with "No organizations found" and no way to diagnose.
- **`AccountSettings` consent fetch silently swallows errors**: `.catch(() => {})` on the consent fetch at AccountSettings.tsx:68 hides failures silently.
- **Frontend sends score/feedback in submit payload that backend ignores**: The `submitAllResults` function sends `score` and `feedback` to `/candidate/submit`, but the backend `submitAnswer` does not destructure these from the body. This is confusing for maintainers and suggests the fields are being saved when they are not.

### Low Severity
- **Inefficient dynamic `bcryptjs` import on every invite generation**: `generateInvite` in `interviewSessionController.js` dynamically imports `bcryptjs` on every call. bcrypt is already a static dependency of `authController.js`.
- **Missing `isDeleted` check in `generateInvite`**: When finding an existing user by email to invite, the function does not check `user.isDeleted`, potentially allowing invites to soft-deleted accounts.
- **AI service `API_KEY` unset warning checks wrong env var**: The AI service checks `os.environ.get("NODE_ENV")` to determine production mode (line 59), but this is a backend env var not typically set in the AI service context.
- **Frontend `useSpeak` hook may attempt speech after unmount**: The `mountedRef` guard is in callbacks but the late-load `voices` array captured in closure may be stale.

## Capabilities

### New Capabilities
- `bug-fixes`: Comprehensive bug fixes across backend, frontend, and AI service. This covers all fixes for the bugs identified in the audit — no new features, only corrections to existing behavior.

### Modified Capabilities
- (No spec-level requirement changes — all bug fixes are implementation corrections that don't alter the defined behavior of existing capabilities.)

## Impact

### Backend
- `backend/controller/interviewSessionController.js`: Fix score/feedback persistence, race condition in submit, duplicate result prevention, add `authorize("candidate")` to routes.
- `backend/controller/rehearsalController.js`: Fix Content-Type header for FormData upload to AI service.
- `backend/routes/interviewSession.js`: Add role authorization to candidate routes.
- `backend/routes/dataRights.js`: Fix dynamic bcrypt import (optional).

### Frontend
- `frontend/src/pages/AccountSettings.tsx`: Fix photo and voice save to use a proper update endpoint instead of the onboarding endpoint. Add proper error handling.
- `frontend/src/pages/RehearsalRoom.tsx`: Stop TTS when starting recording.
- `frontend/src/pages/InterviewSetup.tsx`: Add error handling for org fetch.
- `frontend/src/pages/CandidateInterview.tsx`: Fix submitAllResults race condition, clean up unused payload fields.
- `frontend/src/lib/api.ts`: No changes needed.

### AI Service
- `ai-service/app/main.py`: Fix production-detection logic for `NODE_ENV` check (optional/defensive).
