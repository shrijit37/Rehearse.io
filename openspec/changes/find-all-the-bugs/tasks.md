## 1. Backend: Persist AI evaluation results to database

- [x] 1.1 Modify `POST /api/interviews/candidate/evaluate` (via `evaluateAnswer` in rehearsalController.js or a new wrapper in interviewSessionController.js) to save score/feedback/transcription to the candidate's active `CandidateInvite` result after receiving the AI evaluation
- [x] 1.2 Ensure the evaluate endpoint returns the same `{ score, feedback, transcription }` response shape to the frontend (non-breaking)
- [x] 1.3 Modify the `submitAnswer` controller to check existing results by question text and update status to "completed" without duplicating entries or overwriting scores
- [x] 1.4 Handle the re-recording case: when a result for the same question already exists (from a prior evaluate), update it in place rather than pushing a new entry

## 2. Backend: Add PATCH /api/auth/profile endpoint

- [x] 2.1 Create `updateProfile` controller function in `authController.js` that accepts `{ photo?, audio? }` as partial updates
- [x] 2.2 Reuse the existing `validateBase64Field` helper for each field independently
- [x] 2.3 Use `$set` operator with only provided fields (strip undefined keys) to avoid overwriting existing resume/name fields
- [x] 2.4 Add route `PATCH /api/auth/profile` with `protect` middleware in `routes/auth.js`
- [x] 2.5 Update `AccountSettings.tsx` to call `PATCH /api/auth/profile` instead of `POST /api/auth/onboard` for photo and voice saves

## 3. Backend: Add role authorization to candidate routes

- [x] 3.1 Add `authorize("candidate")` middleware to `GET /candidate/my-interviews` in `routes/interviewSession.js`
- [x] 3.2 Add `authorize("candidate")` middleware to `POST /candidate/evaluate` in `routes/interviewSession.js`
- [x] 3.3 Add `authorize("candidate")` middleware to `POST /candidate/submit` in `routes/interviewSession.js`

## 4. Backend: Fix FormData Content-Type header for AI service upload

- [x] 4.1 Remove the explicit `"Content-Type": "multipart/form-data"` header from the axios POST request in `rehearsalController.js:evaluateAnswer` (line 87)
- [ ] 4.2 Verify that axios auto-generates the correct `multipart/form-data; boundary=...` header when body is FormData

## 5. Frontend: Fix submitAllResults race condition

- [x] 5.1 Replace `Promise.allSettled` in `CandidateInterview.tsx:submitAllResults` with a sequential `for...of` loop that awaits each `api.post()` call in order
- [x] 5.2 Remove the `score` and `feedback` fields from the submit payload (backend ignores them, sending them is misleading)
- [x] 5.3 Ensure the loading state and error handling still work the same way

## 6. Frontend: Fix silent .catch() handlers

- [x] 6.1 Add `console.error` logging to the `.catch(() => {})` in `InterviewSetup.tsx` (org fetch)
- [x] 6.2 Add `console.error` logging to the `.catch(() => {})` in `AccountSettings.tsx` (consent fetch)

## 7. Frontend: Stop TTS before recording in RehearsalRoom

- [x] 7.1 Add `if (speaking) stop();` at the start of `handleToggleRecording` in `RehearsalRoom.tsx`, matching the pattern in `CandidateInterview.tsx`
- [x] 7.2 Verify the `speaking` and `stop` are available from the `useSpeak()` hook (already destructured on line 58)

## 8. Verification

- [ ] 8.1 Verify candidate interview flow end-to-end: create interview → invite → accept via link → record answer → evaluate → submit → verify score/feedback are persisted in MongoDB
- [ ] 8.2 Verify AccountSettings photo save works: capture photo → click "Save Photo" → verify 200 response and photo field updated in DB
- [ ] 8.3 Verify AccountSettings voice save works: record audio → click "Save Calibration" → verify 200 response and audio field updated in DB
- [ ] 8.4 Verify recruiter receives 403 on candidate routes (my-interviews, evaluate, submit)
- [ ] 8.5 Verify audio upload to AI service works (manual Content-Type header removal did not break the upload)
- [ ] 8.6 Verify RehearsalRoom: start TTS → click Record → TTS stops and recording begins
- [ ] 8.7 Verify InterviewSetup shows error banner when org fetch fails (use browser devtools to simulate network error)
- [ ] 8.8 Verify re-recording: evaluate question → get score → re-record same question → verify DB has updated score, not duplicated
