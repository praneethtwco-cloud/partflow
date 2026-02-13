# Implementation Plan: Secure Advanced Sync Options

## Phase 1: UI Modifications
- [x] Task: Modify SyncDashboard.tsx to conditionally show advanced sync options
    - [x] Add state variable to track visibility of advanced options
    - [x] Conditionally render the "Upload All to Cloud" and "Download Latest Master Record" buttons
    - [x] Add subtle hint near Incremental Sync button when advanced options are available

## Phase 2: Settings Integration
- [x] Task: Add toggle switch in settings to control advanced sync visibility
    - [x] Modify Settings.tsx to include a toggle for advanced sync options
    - [x] Store toggle state in local storage or app settings
    - [x] Ensure toggle resets when sync page is reloaded

## Phase 3: State Management
- [x] Task: Implement session-based state management for the toggle
    - [x] Create a mechanism to reset the toggle state when the sync page is accessed
    - [x] Ensure the toggle state persists during the session but resets appropriately

## Phase 4: Testing
- [x] Task: Write tests for the new conditional UI elements
    - [x] Test that advanced options are hidden by default
    - [x] Test that toggling the setting shows/hides the advanced options
    - [x] Test that the toggle state resets when the sync page is reloaded
- [x] Task: Perform manual testing of the UI changes
    - [x] Verify that Incremental Sync button remains visible
    - [x] Verify that advanced options appear when toggle is activated
    - [x] Verify that advanced sync functionality works correctly

## Phase 5: Integration and Validation
- [x] Task: Integrate all components and validate functionality
    - [x] Ensure the toggle in settings properly controls the visibility in SyncDashboard
    - [x] Verify that the subtle hint appears when appropriate
    - [x] Test the reset behavior when navigating away and back to sync page
- [x] Task: Conductor - User Manual Verification 'Phase 5: Integration and Validation' (Protocol in workflow.md)