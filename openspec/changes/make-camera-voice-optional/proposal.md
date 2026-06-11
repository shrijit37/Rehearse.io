## Why

The current onboarding flow requires users to complete camera (photo) and voice (microphone calibration) steps before they can access the platform. This creates friction for users who:
- Are on devices without cameras (desktop PCs, older laptops)
- Have privacy concerns about sharing photos
- Want to quickly test the platform before committing to full setup
- Have microphone issues or are in environments where recording isn't practical

Making these steps optional will reduce onboarding abandonment while still allowing users to complete them later if desired.

## What Changes

- Camera (Photo) step becomes optional - users can skip and proceed without a headshot
- Voice (Microphone calibration) step becomes optional - users can skip and proceed without calibration
- Resume upload remains required as the only mandatory onboarding step
- Users can complete skipped steps later from account settings
- Progress calculation adjusts to account for optional steps being skipped

## Capabilities

### New Capabilities
- `optional-onboarding-steps`: Allows users to skip camera and voice steps during onboarding, with ability to complete them later

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **Frontend**: `Onboarding.tsx` - modify step validation, add skip buttons, update progress calculation
- **Backend**: `authController.js` - modify onboard endpoint to accept partial data (resume only)
- **Database**: User model may need fields to track which onboarding steps are completed
- **UX**: Add "Skip" buttons, visual indicators for optional steps, and prompts to complete skipped steps later
