# Implementation Plan

## Phase 1: Database Logic Updates
- [ ] Task: Update saveOrder function to preserve order_id for existing orders
    - [ ] Modify the saveOrder function to not change order_id when updating existing orders
    - [ ] Ensure invoice_number can be updated independently of order_id
    - [ ] Maintain proper tracking of original_invoice_number for sync purposes
    - [ ] Update any related database operations to respect the distinction between order_id and invoice_number

## Phase 2: Frontend Order Builder Updates
- [ ] Task: Update OrderBuilder to properly handle existing order editing
    - [ ] Modify the handleFinalizeOrder function to preserve the original order_id when editing
    - [ ] Ensure the order ID generation logic only applies to genuinely new orders
    - [ ] Update any UI state management to properly distinguish between new and existing orders
    - [ ] Verify that the invoice number field can be modified without affecting the order ID

## Phase 3: Cache and Sync Updates
- [ ] Task: Update refreshCache and sync logic to properly handle the order_id/invoice_number distinction
    - [ ] Modify refreshCache to not automatically change order_id to invoice_number
    - [ ] Update the sync identifiers to properly track both order_id and invoice_number
    - [ ] Ensure Google Sheets sync operations use the correct identifiers to locate rows
    - [ ] Verify that sync operations update the correct rows based on order_id, not invoice_number

## Phase 4: Testing and Verification
- [ ] Task: Write and execute tests for the invoice editing fix
    - [ ] Write unit tests to verify that saveOrder preserves order_id for existing orders
    - [ ] Write integration tests to verify proper behavior when editing invoices
    - [ ] Test the complete workflow of editing an existing invoice
    - [ ] Verify that sync operations work correctly after the changes
- [ ] Task: Conductor - User Manual Verification 'Testing and Verification' (Protocol in workflow.md)