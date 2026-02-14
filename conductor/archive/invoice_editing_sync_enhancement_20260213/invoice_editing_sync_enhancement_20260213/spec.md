# Invoice Editing and Sync Enhancement Specification

## Overview
Enhance the system to allow editing of invoices that have already been synced to Google Sheets. The system will use invoice numbers as the primary identifier instead of order IDs, and properly update the corresponding rows in Google Sheets when changes are made. This includes tracking changes to invoice numbers and ensuring proper row replacement in the Google Sheet.

## Functional Requirements

### FR-1: Invoice Editing Permission for Synced Orders
- The system shall allow users to edit invoices that have already been synced to Google Sheets
- The system shall maintain all existing invoice editing capabilities for synced invoices
- The system shall preserve the original invoice number for tracking purposes when editing synced orders
- The system shall provide clear indication that an invoice has been previously synced

### FR-2: Invoice Number as Primary Identifier
- The system shall use invoice numbers as the primary identifier instead of order IDs
- The system shall ensure invoice numbers are unique across the entire system
- The system shall maintain sequential numbering based on settings (prefix + number)
- The system shall format invoice numbers with zero-padding (minimum 4 digits)

### FR-3: Google Sheets Row Update Strategy
- The system shall locate the correct row in Google Sheets using the original invoice number as the identifier
- The system shall update the existing row in place rather than creating a new row
- The system shall update all relevant columns in the row with the new invoice data
- The system shall maintain data integrity during the update process

### FR-4: Invoice Number Change Tracking
- The system shall track changes to invoice numbers for synced orders
- The system shall maintain a record of the original invoice number for sync tracking
- The system shall update the Google Sheet row identifier when the invoice number changes
- The system shall prevent conflicts when multiple users modify the same invoice

### FR-5: Sync Conflict Resolution
- The system shall detect potential conflicts when updating synced invoices
- The system shall provide a comparison view showing local vs. cloud data
- The system shall allow users to resolve conflicts manually
- The system shall maintain data consistency between local and cloud data

### FR-6: Settings Configuration
- The system shall provide UI controls to configure the invoice prefix
- The system shall provide UI controls to configure the starting invoice number
- The system shall validate that the invoice prefix contains only valid characters
- The system shall validate that the starting invoice number is a positive integer

## Non-Functional Requirements

### NFR-1: Performance
- The system shall locate and update the correct Google Sheet row within 5 seconds
- The system shall validate invoice number uniqueness within 100ms
- The system shall maintain responsive UI during sync operations

### NFR-2: Usability
- The invoice editing interface shall clearly indicate when an invoice has been synced
- The suggested invoice number shall be prominently displayed when creating invoices
- Error messages for invalid invoice numbers shall be clear and actionable
- The system shall maintain existing user workflows with minimal disruption

### NFR-3: Reliability
- The system shall maintain data integrity during invoice updates
- The system shall handle network interruptions gracefully during sync operations
- The system shall provide recovery mechanisms for failed invoice updates
- The system shall maintain audit logs of all invoice changes

## Acceptance Criteria

1. Users can edit invoices that have already been synced to Google Sheets
2. Invoice numbers are used as the primary identifier instead of order IDs
3. The system locates and updates the correct row in Google Sheets when invoices are modified
4. Changes to invoice numbers are properly tracked and reflected in Google Sheets
5. The system prevents duplicate invoice numbers across the system
6. Invoice numbers follow the correct format (prefix + zero-padded sequential number)
7. The next suggested invoice number is calculated based on the highest existing number in the system
8. Data integrity is maintained throughout the editing and sync process
9. Clear indication is provided when an invoice has been synced
10. Proper conflict resolution is available when issues arise during sync

## Out of Scope

1. Bulk editing of multiple invoices simultaneously
2. Advanced version control for invoice changes
3. Integration with external accounting software for invoice synchronization
4. Automatic conflict resolution without user intervention