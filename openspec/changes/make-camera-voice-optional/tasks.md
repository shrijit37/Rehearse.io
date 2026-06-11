## 1. Backend Changes

- [x] 1.1 Add `onboardingCompleted` field to User model in `backend/db/User.js`
- [x] 1.2 Update `onboard` endpoint in `backend/controller/authController.js` to require resume field
- [x] 1.3 Update `onboard` endpoint to set `onboardingCompleted: true` when onboarding is submitted
- [x] 1.4 Update `getUser` endpoint to return `onboardingCompleted` status

## 2. Frontend - Onboarding Flow

- [x] 2.1 Add "Skip for now" button to step 2 (Camera) in `frontend/src/pages/Onboarding.tsx`
- [x] 2.2 Add "Skip for now" button to step 3 (Voice) in `frontend/src/pages/Onboarding.tsx`
- [x] 2.3 Update `isNextDisabled()` to only require resume on step 1
- [x] 2.4 Update progress calculation to reflect skipped steps
- [x] 2.5 Add informational message when skipping explaining benefits of completion
- [x] 2.6 Update `handleFinish` to send only completed data (resume + optional photo/audio)

## 3. Frontend - Account Settings

- [x] 3.1 Add photo upload section to `frontend/src/pages/AccountSettings.tsx`
- [x] 3.2 Add voice calibration section to `frontend/src/pages/AccountSettings.tsx`
- [x] 3.3 Show completion status for each onboarding step
- [x] 3.4 Allow users to upload photo from account settings
- [x] 3.5 Allow users to record audio from account settings

## 4. Testing & Verification

- [x] 4.1 Test onboarding flow with all steps completed
- [x] 4.2 Test onboarding flow with camera step skipped
- [x] 4.3 Test onboarding flow with voice step skipped
- [x] 4.4 Test onboarding flow with both optional steps skipped
- [x] 4.5 Test account settings photo/voice upload
- [x] 4.6 Verify backend validates resume is present
- [x] 4.7 Run lint and typecheck commands
