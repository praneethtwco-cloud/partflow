# Implementation Plan

## Phase 1: Database Schema Enhancement
- [ ] Task: Add invoice_number field to invoices table
    - [ ] Research current invoice schema in db.ts
    - [ ] Modify database schema to include invoice_number field
    - [ ] Update type definitions for Invoice to include invoice_number
    - [ ] Write migration script if needed for existing data

## Phase 2: Settings Configuration UI
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

## Phase 4: Invoice Creation Integration
- [ ] Task: Integrate invoice numbering into order builder
    - [ ] Modify invoice creation form to display suggested invoice number
    - [ ] Allow manual override of suggested invoice number
    - [ ] Implement real-time validation for duplicate invoice numbers
    - [ ] Show visual indicator when using custom vs. suggested number
    - [ ] Save selected invoice number to database

## Phase 5: Validation and Error Handling
- [ ] Task: Implement comprehensive validation
    - [ ] Real-time duplicate checking when entering invoice number
    - [ ] Format validation to ensure proper prefix + number structure
    - [ ] Display clear error messages for invalid invoice numbers
    - [ ] Prevent saving invoices with duplicate numbers

## Phase 6: Testing and Verification
- [ ] Task: Write and execute tests for invoice numbering
    - [ ] Write unit tests for invoice number generation logic
    - [ ] Write integration tests for settings configuration
    - [ ] Write tests for duplicate validation functionality
    - [ ] Execute end-to-end tests for complete invoice creation flow
- [ ] Task: Conductor - User Manual Verification 'Testing and Verification' (Protocol in workflow.md)