# Invoice Number as Order ID Enhancement Specification

## Overview
Modify the system to use order IDs as invoice numbers, eliminating the separate invoice numbering system. This ensures consistency between order IDs and invoice numbers across the local app and Google Sheets, simplifying the synchronization process and reducing confusion for users.

## Functional Requirements

### FR-1: Order ID as Invoice Number Mapping
- The system shall use the order ID as the invoice number value in all contexts
- The system shall eliminate the separate invoice numbering mechanism
- The system shall maintain the order ID value as the invoice number throughout the order lifecycle
- The system shall ensure that invoice number fields contain the same value as the order ID

### FR-2: Local App Display
- The system shall display the order ID as the invoice number in all UI elements
- The system shall remove any separate invoice number input fields from the order creation/editing interface
- The system shall update all invoice previews and displays to show the order ID as the invoice number
- The system shall maintain all existing order functionality while using order ID as invoice number

### FR-3: Google Sheets Integration
- The system shall update Google Sheets columns to use order ID values directly in the invoice number field
- The system shall modify the sync process to map order IDs to the invoice number column in Google Sheets
- The system shall ensure that existing invoice number entries in Google Sheets are updated to reflect order IDs
- The system shall maintain data integrity during the transition from separate invoice numbers to order ID-based numbering

### FR-4: Invoice Generation and Editing
- The system shall generate invoices using the order ID as the invoice number
- The system shall allow editing of orders while preserving the order ID as the invoice number
- The system shall maintain all existing invoice functionality except for separate invoice number generation
- The system shall ensure that invoice number validation accepts order ID format

### FR-5: Data Consistency
- The system shall ensure that order ID and invoice number fields remain synchronized
- The system shall prevent any discrepancy between order ID and invoice number values
- The system shall maintain referential integrity across all related entities
- The system shall update any existing orders to use order ID as invoice number

## Non-Functional Requirements

### NFR-1: Performance
- The system shall maintain the same performance characteristics as before the change
- The system shall process invoice generation within the same time limits as before
- The system shall maintain responsive UI during sync operations

### NFR-2: Usability
- The system shall maintain the same user experience except for invoice number display
- The system shall provide clear indication that order ID is being used as invoice number
- The system shall maintain all existing workflows and processes

### NFR-3: Compatibility
- The system shall maintain backward compatibility with existing data structures
- The system shall handle the transition from existing invoice numbers to order ID-based numbering gracefully
- The system shall ensure that all existing functionality continues to work as expected

## Acceptance Criteria

1. Order IDs are used as invoice numbers in all contexts (local app and Google Sheets)
2. Separate invoice numbering system is eliminated
3. All UI elements display order ID as invoice number
4. Google Sheets sync process uses order ID values in invoice number column
5. Existing orders are updated to use order ID as invoice number
6. All existing functionality continues to work as expected
7. Data integrity is maintained throughout the transition
8. No discrepancies exist between order ID and invoice number values

## Out of Scope

1. Changing the format or structure of order IDs themselves
2. Modifying other aspects of the order processing workflow
3. Updating unrelated system components beyond invoice number handling
4. Changing the underlying database schema beyond what's necessary for this feature