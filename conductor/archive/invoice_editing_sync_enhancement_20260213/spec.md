# Invoice Editing and Sync Enhancement Specification

## Overview
Enhance the invoice editing functionality to allow modification of invoices that have already been synced to Google Sheets. The system will properly identify and update the correct row in the Google Sheet using a combination of order_id and invoice_number as unique identifiers, with manual conflict resolution when necessary.

## Functional Requirements

### FR-1: Invoice Editing Permission
- The system shall allow users to edit invoices that have already been synced to Google Sheets
- The system shall maintain all existing invoice editing capabilities for synced invoices
- The system shall preserve the original order_id and invoice_number during editing (unless intentionally changed by the user)
- The system shall provide clear indication that an invoice has been previously synced

### FR-2: Invoice Number Modification
- The system shall allow users to modify the invoice number during editing
- The system shall validate the new invoice number according to the existing invoice numbering rules
- The system shall maintain a record of the original invoice number for sync tracking purposes
- The system shall prevent duplicate invoice numbers during the editing process

### FR-3: Unique Identifier Tracking
- The system shall use a combination of order_id and invoice_number as the unique identifier to track invoices
- The system shall maintain this identifier pair even when either value changes during editing
- The system shall use this identifier to locate the correct row in Google Sheets during sync
- The system shall update the identifier mapping when either the order_id or invoice_number changes

### FR-4: Google Sheets Row Update Strategy
- The system shall locate the correct row in Google Sheets using the order_id and invoice_number combination
- The system shall update the existing row in place rather than creating a new row
- The system shall update all relevant columns in the row with the new invoice data
- The system shall maintain data integrity during the update process

### FR-5: Sync Conflict Resolution
- The system shall detect potential conflicts when updating synced invoices
- The system shall prompt the user to resolve conflicts manually when they arise
- The system shall provide a comparison view showing local vs. cloud data
- The system shall allow users to choose which data to keep (local, cloud, or custom merge)

### FR-6: Data Integrity Preservation
- The system shall ensure that all invoice data remains consistent during editing and sync
- The system shall validate that required fields remain populated after editing
- The system shall maintain audit trails for any changes made to synced invoices
- The system shall preserve the sync status of invoices throughout the editing process

## Non-Functional Requirements

### NFR-1: Performance
- The system shall identify and update the correct Google Sheet row within 5 seconds
- The system shall validate invoice number uniqueness within 100ms
- The system shall maintain responsive UI during sync operations

### NFR-2: Usability
- The invoice editing interface shall clearly indicate when an invoice has been synced
- The conflict resolution interface shall be intuitive and easy to use
- Error messages shall be clear and actionable

### NFR-3: Reliability
- The system shall maintain data integrity during sync operations
- The system shall handle network interruptions gracefully
- The system shall provide recovery mechanisms for failed sync attempts

## Acceptance Criteria

1. Users can edit invoices that have already been synced to Google Sheets
2. Invoice numbers can be modified during editing with proper validation
3. The system correctly identifies and updates the appropriate row in Google Sheets
4. A combination of order_id and invoice_number is used as the unique identifier
5. Users are prompted to resolve conflicts manually when they occur
6. Data integrity is maintained throughout the editing and sync process
7. The sync operation updates existing rows in place rather than creating duplicates
8. The system provides clear feedback about the sync status of edited invoices

## Out of Scope

1. Bulk editing of multiple invoices simultaneously
2. Advanced version control for invoice changes
3. Automatic conflict resolution without user intervention
4. Integration with other spreadsheet platforms besides Google Sheets