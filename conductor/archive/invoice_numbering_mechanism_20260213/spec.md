# Invoice Numbering Mechanism Specification

## Overview
Implement an intelligent invoice numbering system that allows users to configure a prefix and starting number, then automatically generates sequential invoice numbers with real-time validation and manual override capability.

## Functional Requirements

### FR-1: Invoice Prefix Configuration
- The system shall allow users to configure an invoice prefix in the main application settings
- The prefix shall support alphanumeric characters and hyphens
- The prefix shall have a maximum length of 10 characters
- The system shall validate that the prefix is not empty when saving settings

### FR-2: Starting Invoice Number Configuration
- The system shall provide a separate field in settings for configuring the starting invoice number
- The starting number shall be a positive integer
- The system shall validate that the starting number is not negative or zero
- The system shall use this number as the basis for the first invoice when no previous invoices exist

### FR-3: Sequential Invoice Number Generation
- The system shall suggest the next sequential invoice number when creating a new invoice
- The suggested number shall follow the format: [prefix][sequential_number] (e.g., VM0001, VM0002)
- The system shall calculate the next number by finding the highest existing invoice number in the database and incrementing it
- The sequential part shall be zero-padded to at least 4 digits (e.g., 0001, 0002)

### FR-4: Manual Override Capability
- The system shall allow users to manually override the suggested invoice number
- The system shall provide a clear indication when the user is using a custom number instead of the suggested one
- The system shall maintain the automatic suggestion for reference even when overridden

### FR-5: Real-time Validation
- The system shall validate invoice numbers in real-time to prevent duplicates
- The system shall enforce the correct format (prefix followed by numeric sequence)
- The system shall display immediate feedback if the entered number already exists
- The system shall prevent saving an invoice with a duplicate number

### FR-6: Invoice Display and Storage
- The system shall store invoice numbers in a dedicated field in the invoice record
- The system shall display invoice numbers consistently throughout the application
- The system shall sort invoices by their numerical sequence when displaying lists

## Non-Functional Requirements

### NFR-1: Performance
- The system shall calculate the next invoice number within 500ms
- The system shall validate invoice numbers within 100ms

### NFR-2: Usability
- The invoice number settings shall be easily accessible from the main settings page
- The suggested invoice number shall be prominently displayed when creating invoices
- Error messages for invalid invoice numbers shall be clear and actionable

## Acceptance Criteria

1. Users can configure an invoice prefix in the main settings
2. Users can configure a starting invoice number in the main settings
3. When creating a new invoice, the system suggests the next sequential number
4. Users can override the suggested number with a custom one
5. The system validates invoice numbers in real-time to prevent duplicates
6. Invoice numbers follow the correct format (prefix + zero-padded sequential number)
7. The next suggested number is calculated based on the highest existing number in the database
8. Invoice numbers are stored and displayed consistently throughout the application

## Out of Scope

1. Exporting invoice numbers to external systems
2. Integration with external accounting software for invoice number synchronization
3. Advanced invoice number formatting options (e.g., date-based prefixes)
4. Bulk invoice number assignment