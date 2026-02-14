# Implementation Plan

## Phase 1: Database Schema and Model Updates
- [ ] Task: Update Order model to use invoice number as primary identifier
    - [ ] Modify Order type definition to ensure invoice_number is the primary identifier
    - [ ] Update database schema if needed to reflect the change
    - [ ] Create migration script to update existing orders to use invoice_number as order_id
    - [ ] Update any indexes or constraints related to the change

## Phase 2: Backend Sync Logic Updates
- [ ] Task: Modify Google Sheets sync logic for invoice updates
    - [ ] Update sync service to locate rows using invoice_number as the identifier
    - [ ] Implement logic to find and update specific rows using invoice_number as locator
    - [ ] Add conflict detection mechanism for synced invoices
    - [ ] Update syncData function to handle invoice number changes properly

## Phase 3: Frontend Invoice Editing Interface
- [ ] Task: Update invoice editing UI with proper sync indicators
    - [ ] Modify OrderBuilder component to display sync status indicators
    - [ ] Implement invoice number validation during editing
    - [ ] Add visual indicators for synced invoices
    - [ ] Update invoice preview to show proper identifiers

## Phase 4: Settings Configuration Updates
- [ ] Task: Enhance settings page with invoice numbering options
    - [ ] Add invoice prefix input field to settings form
    - [ ] Add starting invoice number input field to settings form
    - [ ] Implement validation for prefix format and starting number
    - [ ] Save settings to application configuration
    - [ ] Retrieve and display current settings values

## Phase 5: Invoice Number Generation Logic
- [ ] Task: Implement invoice number calculation service
    - [ ] Create utility function to extract numeric part from invoice number
    - [ ] Create function to find highest existing invoice number in database
    - [ ] Create function to generate next sequential number based on settings
    - [ ] Implement zero-padding logic (minimum 4 digits)
    - [ ] Create function to format invoice number with prefix

## Phase 6: Validation and Conflict Resolution
- [ ] Task: Implement comprehensive validation and conflict resolution
    - [ ] Real-time duplicate checking when entering invoice number
    - [ ] Format validation to ensure proper prefix + number structure
    - [ ] Conflict detection when updating synced invoices
    - [ ] Display appropriate error messages when validation fails

## Phase 7: Testing and Verification
- [ ] Task: Write and execute tests for invoice editing and sync
    - [ ] Write unit tests for invoice number generation logic
    - [ ] Write integration tests for Google Sheets sync with new identifiers
    - [ ] Write tests for conflict resolution functionality
    - [ ] Execute end-to-end tests for complete invoice editing and sync flow
- [ ] Task: Conductor - User Manual Verification 'Testing and Verification' (Protocol in workflow.md)