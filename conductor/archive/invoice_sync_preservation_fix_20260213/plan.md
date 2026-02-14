# Implementation Plan

## Phase 1: Sync Logic Updates
- [ ] Task: Update sync process to preserve draft orders
    - [ ] Modify performSync function to only replace synced orders (not draft orders)
    - [ ] Implement logic to separate draft orders from synced orders during pull operations
    - [ ] Update the order replacement logic to maintain local draft orders
    - [ ] Ensure that only approved orders are included in the sync payload to Google Sheets

## Phase 2: Invoice Number Display Updates
- [ ] Task: Ensure full invoice numbers are displayed in UI
    - [ ] Update InvoicePreview component to show complete invoice numbers
    - [ ] Update OrderBuilder component to properly display invoice numbers
    - [ ] Update any other components that might be showing truncated invoice numbers
    - [ ] Verify invoice number display in PDF generation

## Phase 3: Conflict Resolution Updates
- [ ] Task: Update conflict detection to handle different approval statuses
    - [ ] Modify checkForConflicts function to only check for conflicts with synced orders
    - [ ] Update conflict resolution logic to preserve draft order data
    - [ ] Ensure conflict detection properly identifies orders by approval status
    - [ ] Test conflict resolution with mixed approval status orders

## Phase 4: Data Integrity Verification
- [ ] Task: Verify data integrity after sync updates
    - [ ] Test sync operations with mixed approval status orders
    - [ ] Verify that draft orders remain accessible after sync
    - [ ] Ensure customer-order relationships are maintained
    - [ ] Validate that order status tracking works correctly

## Phase 5: Testing and Verification
- [ ] Task: Write and execute tests for the sync preservation fix
    - [ ] Write unit tests for the updated sync logic
    - [ ] Write integration tests for draft order preservation
    - [ ] Write tests for invoice number display functionality
    - [ ] Execute end-to-end tests for complete sync workflow with different approval statuses
- [ ] Task: Conductor - User Manual Verification 'Testing and Verification' (Protocol in workflow.md)