# Bug Fixes

## Purpose

This spec documents functional correctness requirements for bug fixes identified during codebase audit. Each requirement addresses a specific bug or anti-pattern that would cause data loss, incorrect behavior, or degraded user experience.

## Requirements

### Requirement: AI evaluation results shall be persisted to the database

When a candidate records an answer and the AI evaluates it, the system SHALL save the score, feedback, and transcription to the CandidateInvite results array before returning the response to the candidate. The candidate's interview dashboard SHALL reflect these scores after a page refresh.

#### Scenario: Successful evaluation saves score and feedback
- **WHEN** a candidate records an audio answer and submits it via `POST /candidate/evaluate`
- **THEN** the backend SHALL call the AI service for transcription/score/feedback
- **AND** the backend SHALL save the result `{ question, transcription, score, feedback }` to the candidate's active `CandidateInvite` document
- **AND** the backend SHALL return `{ score, feedback, transcription }` to the frontend

#### Scenario: Evaluation result persists across page reload
- **WHEN** a candidate refreshes the candidate interview page
- **THEN** the restored `invite.results` from DB SHALL contain the previously evaluated score, feedback, and transcription for each answered question

#### Scenario: Multiple evaluations of the same question update rather than duplicate
- **WHEN** a candidate re-records an answer to the same question
- **AND** the AI evaluates the new audio
- **THEN** the existing result entry for that question SHALL be updated with the new score, feedback, and transcription
- **AND** no duplicate result entries SHALL be created

### Requirement: Candidate answer submission shall preserve existing evaluation data

The `POST /candidate/submit` endpoint SHALL only update submission metadata (status, completedAt) and SHALL NOT overwrite existing score/feedback values.

#### Scenario: Submit preserves saved evaluation
- **WHEN** a question has been previously evaluated and saved (score=7, feedback="Good answer")
- **AND** the candidate clicks "Submit" to finish
- **THEN** the stored score and feedback SHALL remain unchanged
- **AND** the invite status SHALL be updated to "completed"

### Requirement: AccountSettings photo and voice save shall use a dedicated endpoint

The AccountSettings page SHALL save profile photo and voice calibration audio using a `PATCH /api/auth/profile` endpoint that supports partial updates. This endpoint SHALL NOT require a `resume` field.

#### Scenario: Save photo from AccountSettings
- **WHEN** a user captures a photo in AccountSettings
- **AND** clicks "Save Photo"
- **THEN** the frontend SHALL POST `{ photo: "data:image/jpeg;base64,..." }` to `PATCH /api/auth/profile`
- **AND** the backend SHALL update only the `photo` field on the user document
- **AND** the backend SHALL NOT modify or require `resume` or `resumeName`

#### Scenario: Save voice calibration from AccountSettings
- **WHEN** a user records voice calibration in AccountSettings
- **AND** clicks "Save Calibration"
- **THEN** the frontend SHALL POST `{ audio: "data:audio/webm;base64,..." }` to `PATCH /api/auth/profile`
- **AND** the backend SHALL update only the `audio` field on the user document
- **AND** the backend SHALL NOT modify or require `resume` or `resumeName`

#### Scenario: Invalid base64 photo rejected
- **WHEN** a user submits a non-base64 or corrupted photo string
- **THEN** the backend SHALL return a 400 error with a descriptive message
- **AND** SHALL NOT update any user fields

### Requirement: Candidate API routes shall require candidate role authorization

The three candidate-specific API routes SHALL require the authenticated user to have the "candidate" role. A recruiter SHALL NOT access these routes.

#### Scenario: Candidate accesses own interview list
- **WHEN** a user with role "candidate" sends GET to `/api/interviews/candidate/my-interviews`
- **THEN** the server SHALL return their interview invites

#### Scenario: Recruiter cannot access candidate routes
- **WHEN** a user with role "recruiter" sends GET to `/api/interviews/candidate/my-interviews`
- **THEN** the server SHALL return a 403 Forbidden response

#### Scenario: Unauthenticated request to candidate route
- **WHEN** a request without a valid JWT token is sent to `POST /api/interviews/candidate/evaluate`
- **THEN** the server SHALL return 401 Unauthorized

### Requirement: RehearsalRoom shall stop TTS before recording

The RehearsalRoom page SHALL cancel any active text-to-speech playback when the user starts recording an answer. This matches the existing behavior in the CandidateInterview page.

#### Scenario: TTS stops on recording start
- **WHEN** the user is listening to a question via TTS
- **AND** clicks the "Record" button
- **THEN** TTS playback SHALL be cancelled immediately
- **AND** recording SHALL begin without audio overlap

### Requirement: InterviewSetup shall surface org fetch errors

If the organization list fails to load on the InterviewSetup page, the error SHALL be logged to the console and SHALL be displayed to the user in the error banner, not silently swallowed.

#### Scenario: Org fetch failure shows error
- **WHEN** the InterviewSetup page loads
- **AND** the GET /api/org request fails
- **THEN** the error SHALL be logged to console.error
- **AND** the page SHALL show the error in the banner (existing error UI)
- **AND** the organization dropdown SHALL remain disabled/empty

### Requirement: AccountSettings consent fetch shall surface errors

If the consent status fails to load on the AccountSettings page, the error SHALL be logged to the console (not silently swallowed).

#### Scenario: Consent fetch failure logs error
- **WHEN** the AccountSettings page loads
- **AND** the GET /api/auth/consent request fails
- **THEN** the error SHALL be logged to console.error
- **AND** the consent section SHALL show default (no consent) state gracefully

### Requirement: Candidate answer submission shall be sequential

The `submitAllResults` function SHALL submit answers one at a time in question-index order to prevent race conditions in the server-side completion detection.

#### Scenario: Sequential submission prevents completion race
- **WHEN** a candidate finishes an interview with 3 answered questions
- **AND** the submit function sends each answer in order (question 0, then 1, then 2)
- **THEN** the server SHALL detect completion only after all 3 results are persisted
- **AND** `invite.results` SHALL contain exactly 3 entries in question-index order

### Requirement: Audio evaluation request shall not manually set Content-Type header

The backend `evaluateAnswer` controller SHALL NOT set a custom `Content-Type` header when sending FormData to the AI service. Axios SHALL generate the correct multipart boundary automatically.

#### Scenario: FormData upload succeeds with correct boundary
- **WHEN** the backend sends audio data to the AI service via axios with FormData body
- **AND** no explicit `Content-Type` header is set
- **THEN** axios SHALL auto-generate the `multipart/form-data; boundary=...` header
- **AND** the AI service SHALL accept and process the file
