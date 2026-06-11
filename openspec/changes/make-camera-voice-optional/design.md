## Context

The onboarding flow in `Onboarding.tsx` currently requires users to complete all 3 steps (Resume, Photo, Voice) before accessing the platform. The backend `onboard` endpoint at `authController.js:162` accepts all three fields but doesn't enforce that resume is present. The `onboarded` status is determined by `Boolean(user.resume)` at login time.

**Current state:**
- Frontend: 3 mandatory steps with no skip option
- Backend: Accepts partial data but doesn't track completion status
- User model: Has `resume`, `photo`, `audio` fields (all optional in schema)

## Goals / Non-Goals

**Goals:**
- Make camera (Photo) and voice (Microphone calibration) steps optional during onboarding
- Allow users to skip these steps and complete them later from account settings
- Keep resume upload as the only required onboarding step
- Maintain backward compatibility with existing users who have completed all steps

**Non-Goals:**
- Removing the camera/voice features entirely
- Changing the evaluation logic or AI scoring
- Modifying the interview flow (CandidateInterview, RehearsalRoom)

## Decisions

### 1. Frontend skip mechanism
**Decision**: Add "Skip for now" buttons to steps 2 and 3, with visual indicators showing these steps are optional.

**Rationale**: 
- Clear UX that these steps can be completed later
- Progress bar adjusts to show 1/3 completed after skipping both
- Users can return to complete skipped steps from dashboard or account settings

**Alternatives considered**:
- Auto-skipping: Rejected because users might want to see the options
- Making all steps optional: Rejected because resume is essential for AI evaluation

### 2. Backend onboarding completion tracking
**Decision**: Add `onboardingCompleted: Boolean` field to User model to track if user has finished onboarding (even if they skipped steps).

**Rationale**:
- Current `onboarded` status only checks `Boolean(user.resume)` which doesn't reflect if user actually completed onboarding
- New field allows distinguishing between "user skipped steps" vs "user hasn't onboarded yet"
- Enables showing completion prompts for skipped steps

**Alternatives considered**:
- Array of completed steps: More complex, unnecessary for this use case
- Separate onboarding_progress field: Overkill for boolean state

### 3. Account settings for completing skipped steps
**Decision**: Add photo/voice upload sections to AccountSettings.tsx for users who skipped during onboarding.

**Rationale**:
- Users need a way to complete skipped steps
- Account settings is the natural place for profile management
- Reuses existing camera/mic components from Onboarding.tsx

## Risks / Trade-offs

**Risk**: Users who skip all optional steps may have lower quality AI evaluations
→ **Mitigation**: Show informational message when skipping explaining benefits of completion

**Risk**: Backend onboard endpoint doesn't validate resume presence
→ **Mitigation**: Add validation to require resume field in onboard endpoint

**Risk**: Existing onboarded users may see prompts to complete steps they already did
→ **Mitigation**: Check if photo/audio fields already have data before showing completion prompts
