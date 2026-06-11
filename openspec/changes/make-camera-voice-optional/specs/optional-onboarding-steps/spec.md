## ADDED Requirements

### Requirement: Users can skip camera step during onboarding
The system SHALL allow users to skip the camera (photo) step during onboarding without completing it.

#### Scenario: User skips camera step
- **WHEN** user is on step 2 (Photo) of onboarding
- **AND** user clicks "Skip for now" button
- **THEN** system advances to step 3 (Voice) without requiring photo capture

### Requirement: Users can skip voice step during onboarding
The system SHALL allow users to skip the voice (microphone calibration) step during onboarding without completing it.

#### Scenario: User skips voice step
- **WHEN** user is on step 3 (Voice) of onboarding
- **AND** user clicks "Skip for now" button
- **THEN** system completes onboarding without requiring microphone calibration

### Requirement: Resume upload remains required
The system SHALL require users to upload a resume before completing onboarding.

#### Scenario: User tries to skip resume step
- **WHEN** user is on step 1 (Resume) of onboarding
- **AND** user has not uploaded a resume file
- **THEN** "Continue" button remains disabled

### Requirement: Onboarding completion tracked
The system SHALL track whether a user has completed onboarding, even if they skipped optional steps.

#### Scenario: User completes onboarding with skipped steps
- **WHEN** user completes onboarding after skipping camera and/or voice steps
- **THEN** system sets `onboardingCompleted: true` on user record
- **AND** system allows user to access dashboard

### Requirement: Progress bar reflects skipped steps
The system SHALL adjust progress calculation to account for optional steps being skipped.

#### Scenario: User skips both optional steps
- **WHEN** user skips camera and voice steps
- **THEN** progress bar shows 100% after completing resume upload
- **AND** "Finish" button becomes available on step 1

### Requirement: Skip buttons visually indicate optional nature
The system SHALL display "Skip for now" buttons with clear visual indication that steps are optional.

#### Scenario: User sees skip option on camera step
- **WHEN** user is on step 2 (Photo) of onboarding
- **THEN** "Skip for now" button is visible below the camera capture area
- **AND** button text indicates step is optional

### Requirement: Backend accepts partial onboarding data
The system SHALL accept onboarding submissions with only resume data (photo and audio optional).

#### Scenario: User submits onboarding with resume only
- **WHEN** user calls POST /api/auth/onboard
- **AND** request body contains only resume data (no photo or audio)
- **THEN** system processes the request successfully
- **AND** system stores resume data on user record

### Requirement: Backend validates resume is present
The system SHALL require resume field in onboarding submissions.

#### Scenario: User submits onboarding without resume
- **WHEN** user calls POST /api/auth/onboard
- **AND** request body does not contain resume field
- **THEN** system returns 400 error with message "Resume is required"

### Requirement: Account settings shows completion status
The system SHALL display which onboarding steps have been completed in account settings.

#### Scenario: User views account settings with skipped steps
- **WHEN** user navigates to account settings
- **AND** user skipped camera step during onboarding
- **THEN** system shows camera section with "Not completed" status
- **AND** system provides option to upload photo

### Requirement: Users can complete skipped steps from account settings
The system SHALL allow users to complete previously skipped onboarding steps from account settings.

#### Scenario: User completes camera step from settings
- **WHEN** user uploads photo in account settings
- **AND** user previously skipped camera step during onboarding
- **THEN** system stores photo on user record
- **AND** system updates completion status
