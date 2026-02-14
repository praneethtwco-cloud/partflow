# Implementation Plan

## Phase 1: Database Schema and Model Updates
- [ ] Task: Update Order model to include approval status
    - [ ] Add approval_status field to Order type definition with values: 'draft', 'pending_approval', 'approved'
    - [ ] Update database schema to include approval_status field in orders table
    - [ ] Create migration script to update existing orders with default 'approved' status
    - [ ] Update any indexes or constraints related to approval status

## Phase 2: Sequential Order ID Generation Logic
- [ ] Task: Implement sequential order ID generation service
    - [ ] Create utility function to extract numeric part from order/invoice number
    - [ ] Create function to find highest existing order ID in database
    - [ ] Create function to generate next sequential number based on settings
    - [ ] Implement zero-padding logic (minimum 4 digits)
    - [ ] Create function to format order ID with prefix from settings

## Phase 3: Settings Configuration Updates
- [ ] Task: Verify settings configuration for invoice numbering
    - [ ] Confirm invoice_prefix and starting_invoice_number settings are available
    - [ ] Ensure these settings are properly loaded in the application
    - [ ] Verify settings are accessible where order ID generation occurs

## Phase 4: Frontend Order Editing Interface
- [ ] Task: Update order editing UI with approval status controls
    - [ ] Add approval status dropdown to order form with options: Draft, Pending Approval, Approved
    - [ ] Implement logic to lock editing controls when status is 'approved'
    - [ ] Add visual indicators for locked orders
    - [ ] Update order ID display to show sequential number instead of random ID
    - [ ] Implement approval status change tracking

## Phase 5: Google Sheets Integration Updates
- [ ] Task: Modify Google Sheets sync logic for approval status
    - [ ] Update sync service to only sync orders with 'approved' status
    - [ ] Implement logic to remove unapproved orders from Google Sheets if they were previously synced
    - [ ] Add approval status field to Google Sheets sync mapping
    - [ ] Update syncData function to handle approval status filtering

## Phase 6: Validation and Edit Restriction Logic
- [ ] Task: Implement comprehensive validation and restriction logic
    - [ ] Real-time check for approval status when editing fields
    - [ ] Prevent saving changes to approved orders
    - [ ] Display appropriate error messages when trying to edit locked orders
    - [ ] Implement proper UI state management based on approval status

## Phase 7: Testing and Verification
- [ ] Task: Write and execute tests for new functionality
    - [ ] Write unit tests for sequential order ID generation logic
    - [ ] Write integration tests for approval status functionality
    - [ ] Write tests for edit restriction logic
    - [ ] Execute end-to-end tests for complete order creation and approval flow
- [ ] Task: Conductor - User Manual Verification 'Testing and Verification' (Protocol in workflow.md)