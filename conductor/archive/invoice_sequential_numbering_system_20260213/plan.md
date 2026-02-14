# Implementation Plan

## Phase 1: Database Schema and Model Updates
- [ ] Task: Update Order model to support sequential invoice numbering
    - [ ] Modify Order type definition to ensure proper invoice_number field handling
    - [ ] Update database schema if needed to reflect the change
    - [ ] Create migration script to update existing orders to use new sequential numbering
    - [ ] Update any indexes or constraints related to invoice numbers

## Phase 2: Settings Configuration Updates
- [ ] Task: Enhance settings page with invoice numbering options
    - [ ] Add invoice prefix input field to settings form
    - [ ] Add starting invoice number input field to settings form
    - [ ] Implement validation for prefix format and starting number
    - [ ] Save settings to application configuration
    - [ ] Retrieve and display current settings values

## Phase 3: Invoice Number Generation Logic
- [ ] Task: Implement invoice number calculation service
    - [ ] Create utility function to extract numeric part from invoice number
    - [ ] Create function to find highest existing invoice number in database
    - [ ] Create function to generate next sequential number based on settings
    - [ ] Implement zero-padding logic (minimum 4 digits)
    - [ ] Create function to format invoice number with prefix

## Phase 4: Frontend Invoice Editing Interface
- [ ] Task: Update invoice editing UI with sequential numbering
    - [ ] Modify OrderBuilder component to display suggested invoice number
    - [ ] Allow manual override of suggested invoice number
    - [ ] Implement real-time validation for duplicate invoice numbers
    - [ ] Show visual indicator when using custom vs. suggested number
    - [ ] Save selected invoice number to database

## Phase 5: Google Sheets Integration Updates
- [ ] Task: Modify Google Sheets sync logic for invoice updates
    - [ ] Update sheets service to handle invoice updates using unique identifiers
    - [ ] Implement logic to find and update specific rows using order_id as locator
    - [ ] Add conflict detection mechanism for synced invoices
    - [ ] Update syncData function to handle invoice number changes

## Phase 6: Validation and Error Handling
- [ ] Task: Implement comprehensive validation
    - [ ] Real-time duplicate checking when entering invoice number
    - [ ] Format validation to ensure proper prefix + number structure
    - [ ] Display clear error messages for invalid invoice numbers
    - [ ] Prevent saving invoices with duplicate numbers

## Phase 7: Testing and Verification
- [ ] Task: Write and execute tests for invoice numbering
    - [ ] Write unit tests for invoice number generation logic
    - [ ] Write integration tests for settings configuration
    - [ ] Write tests for duplicate validation functionality
    - [ ] Execute end-to-end tests for complete invoice creation flow
- [ ] Task: Conductor - User Manual Verification 'Testing and Verification' (Protocol in workflow.md)