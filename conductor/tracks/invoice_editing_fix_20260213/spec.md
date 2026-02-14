# Invoice Editing Issue Fix Specification

## Overview
Fix the issue where editing an existing invoice was creating a new record instead of updating the existing one. The system should preserve the original order ID during invoice editing to ensure proper updates to existing records while allowing invoice number changes.

## Problem Statement
When users edit an existing invoice, the system was treating it as a new invoice instead of updating the existing record. This was caused by changing the order_id to match the invoice_number during editing, which resulted in creating new records rather than updating existing ones.

## Functional Requirements

### FR-1: Preserve Order ID During Editing
- The system shall maintain the original order_id when editing existing invoices
- The system shall not change the order_id when the invoice number is modified
- The system shall update the existing record with the new invoice number
- The system shall maintain the connection between the order and its original identifier

### FR-2: Invoice Number Updates
- The system shall allow users to modify the invoice number for existing orders
- The system shall validate the new invoice number according to existing rules
- The system shall update the invoice_number field in the existing record
- The system shall maintain audit trails for invoice number changes

### FR-3: Sync Behavior Preservation
- The system shall continue to properly sync updated invoices to Google Sheets
- The system shall use the original order identifier to locate the correct row in Google Sheets
- The system shall update the invoice number field in the appropriate row in Google Sheets
- The system shall maintain data integrity during sync operations

### FR-4: Database Consistency
- The system shall ensure that order_id remains constant for existing orders
- The system shall allow invoice_number to be modified independently of order_id
- The system shall maintain referential integrity across related entities
- The system shall properly update the cache when records are modified

### FR-5: User Experience
- The system shall provide clear feedback when an invoice is successfully updated
- The system shall maintain all existing UI behaviors for invoice editing
- The system shall preserve the order ID in the UI display where appropriate
- The system shall continue to validate invoice numbers in real-time

## Non-Functional Requirements

### NFR-1: Performance
- The system shall maintain the same performance characteristics as before the fix
- The system shall process invoice updates within the same time limits as before
- The system shall maintain responsive UI during edit operations

### NFR-2: Usability
- The system shall maintain the same user experience for invoice editing
- Users should not notice any changes in the workflow except that edits now properly update existing records
- Error messages and validations should remain consistent

### NFR-3: Reliability
- The system shall maintain data integrity during the update process
- The system shall handle edge cases gracefully (e.g., network interruptions during sync)
- The system shall provide recovery mechanisms for failed updates

## Acceptance Criteria

1. Editing an existing invoice updates the record instead of creating a new one
2. The order_id remains unchanged when editing an existing invoice
3. The invoice_number can be modified independently of the order_id
4. Updated invoices are properly synced to Google Sheets with the correct row updates
5. All existing functionality continues to work as expected
6. Data integrity is maintained throughout the process
7. No duplicate records are created when editing existing invoices
8. The UI behaves consistently with the updated backend logic

## Out of Scope

1. Changing the fundamental architecture of the order/invoice system
2. Modifying other unrelated sync behaviors
3. Updating the core data model beyond what's necessary for this fix
4. Making changes to unrelated components or features