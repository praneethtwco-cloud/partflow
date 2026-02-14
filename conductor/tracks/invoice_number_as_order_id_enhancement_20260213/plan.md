# Implementation Plan

## Phase 1: Database Schema and Model Updates
- [ ] Task: Update Order model to align invoice number with order ID
    - [ ] Modify Order type definition to ensure invoice_number field mirrors order_id
    - [ ] Update database schema if needed to reflect the change
    - [ ] Create migration script to update existing orders to use order_id as invoice_number
    - [ ] Update any indexes or constraints related to invoice numbers

## Phase 2: Backend Logic Updates
- [ ] Task: Modify invoice number generation logic
    - [ ] Remove or disable existing invoice numbering system
    - [ ] Update order creation logic to set invoice_number equal to order_id
    - [ ] Update order editing logic to maintain invoice_number as order_id
    - [ ] Update any invoice number validation to accept order ID format

## Phase 3: Frontend UI Updates
- [ ] Task: Update invoice display in local app
    - [ ] Modify OrderBuilder component to display order_id as invoice number
    - [ ] Remove or hide separate invoice number input field
    - [ ] Update InvoicePreview component to show order_id as invoice number
    - [ ] Update any other UI components that display invoice numbers

## Phase 4: Google Sheets Integration Updates
- [ ] Task: Modify Google Sheets sync logic
    - [ ] Update sheets service to map order_id to invoice number column in Google Sheets
    - [ ] Modify syncData function to use order_id values in invoice number field
    - [ ] Update conflict resolution logic to handle order_id as invoice number
    - [ ] Ensure proper mapping during both upload and download operations

## Phase 5: Data Migration
- [ ] Task: Migrate existing data to new format
    - [ ] Create script to update all existing orders to use order_id as invoice_number
    - [ ] Update any related entities that reference invoice numbers
    - [ ] Verify data consistency after migration
    - [ ] Handle edge cases where order_id and invoice_number differ

## Phase 6: Testing and Verification
- [ ] Task: Write and execute tests for the new system
    - [ ] Write unit tests for updated order creation logic
    - [ ] Write integration tests for Google Sheets sync with new format
    - [ ] Write tests to verify order_id and invoice_number consistency
    - [ ] Execute end-to-end tests for complete order flow
- [ ] Task: Conductor - User Manual Verification 'Testing and Verification' (Protocol in workflow.md)