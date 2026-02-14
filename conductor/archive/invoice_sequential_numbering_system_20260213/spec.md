# Invoice Sequential Numbering System Specification

## Overview
Replace the current system where invoice numbers are identical to order IDs with a sequential numbering system that allows users to configure a prefix and starting number. This system will enable users to have invoice numbers like "VM0001", "VM0002", etc., while maintaining the ability to edit synced invoices and properly update Google Sheets.

## Functional Requirements

### FR-1: Configurable Invoice Numbering System
- The system shall allow users to configure an invoice prefix in the main settings (e.g., "VM")
- The system shall allow users to configure a starting invoice number in the main settings (e.g., 1)
- The system shall generate sequential invoice numbers following the format: [prefix][zero-padded-number] (e.g., VM0001, VM0002)
- The system shall maintain the sequential numbering across all invoices in the system

### FR-2: Invoice Number Generation
- The system shall generate the next sequential invoice number based on the highest existing invoice number in the system
- The system shall format the invoice number with zero-padding to at least 4 digits (e.g., 0001, 0002)
- The system shall allow users to manually override the suggested invoice number during order creation
- The system shall validate that manually entered invoice numbers follow the correct format

### FR-3: Invoice Number Editing
- The system shall allow users to edit invoice numbers for both new and existing orders
- The system shall validate that edited invoice numbers are unique in the system
- The system shall prevent saving orders with duplicate invoice numbers
- The system shall maintain a log of invoice number changes for audit purposes

### FR-4: Synced Invoice Editing
- The system shall allow users to edit invoice numbers for orders that have already been synced to Google Sheets
- The system shall track changes to invoice numbers for synced orders
- The system shall update the corresponding row in Google Sheets with the new invoice number when changes are made
- The system shall maintain data integrity during the update process

### FR-5: Google Sheets Integration
- The system shall update the existing row in Google Sheets when an invoice number is changed (rather than creating a new row)
- The system shall use the original order identifier to locate the correct row in Google Sheets
- The system shall update all relevant columns in the row with the new invoice number
- The system shall maintain data consistency between local and cloud data

### FR-6: Settings Configuration
- The system shall provide UI controls in the settings page to configure the invoice prefix
- The system shall provide UI controls in the settings page to configure the starting invoice number
- The system shall validate that the invoice prefix contains only valid characters
- The system shall validate that the starting invoice number is a positive integer

## Non-Functional Requirements

### NFR-1: Performance
- The system shall generate the next invoice number within 100ms
- The system shall validate invoice number uniqueness within 200ms
- The system shall maintain responsive UI during sync operations

### NFR-2: Usability
- The invoice number settings shall be easily accessible from the main settings page
- The suggested invoice number shall be prominently displayed when creating invoices
- Error messages for invalid invoice numbers shall be clear and actionable
- The system shall provide visual feedback when updating invoice numbers in Google Sheets

### NFR-3: Reliability
- The system shall maintain data integrity during invoice number updates
- The system shall handle network interruptions gracefully during sync operations
- The system shall provide recovery mechanisms for failed invoice number updates
- The system shall maintain audit logs of all invoice number changes

## Acceptance Criteria

1. Users can configure an invoice prefix in the main settings
2. Users can configure a starting invoice number in the main settings
3. When creating a new invoice, the system suggests the next sequential number
4. Users can override the suggested number with a custom one
5. The system validates invoice numbers in real-time to prevent duplicates
6. Invoice numbers follow the correct format (prefix + zero-padded sequential number)
7. The next suggested number is calculated based on the highest existing number in the system
8. Users can edit invoice numbers for synced orders
9. Changes to invoice numbers are properly reflected in Google Sheets
10. The system maintains audit logs of invoice number changes
11. Data integrity is maintained throughout the process

## Out of Scope

1. Exporting invoice numbers to external systems
2. Integration with external accounting software for invoice number synchronization
3. Advanced invoice number formatting options (e.g., date-based prefixes)
4. Bulk invoice number assignment