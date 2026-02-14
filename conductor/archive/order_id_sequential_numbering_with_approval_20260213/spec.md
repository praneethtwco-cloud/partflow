# Order ID Sequential Numbering and Approval System Specification

## Overview
Replace the current system where order IDs are randomly generated with a sequential numbering system that follows the same pattern as the invoice numbering system. This system will use the existing invoice prefix and starting number settings to generate sequential order IDs (which will also serve as invoice numbers). Additionally, implement an approval workflow with "Draft", "Pending Approval", and "Approved" statuses that controls editability and sync behavior.

## Functional Requirements

### FR-1: Sequential Order ID Generation
- The system shall generate sequential order IDs using the existing invoice prefix and starting number settings
- The system shall follow the format: [invoice_prefix][zero-padded-number] (e.g., VM0001, VM0002)
- The system shall ensure order IDs are unique across the entire system
- The system shall maintain sequential numbering even when orders are deleted
- The system shall continue the sequence from the highest existing order ID when new orders are created

### FR-2: Approval Status Implementation
- The system shall implement three approval statuses: "Draft", "Pending Approval", and "Approved"
- The system shall default new orders to "Draft" status
- The system shall allow users to change the approval status through the order interface
- The system shall track the date and user who changed the approval status
- The system shall maintain an audit trail of approval status changes

### FR-3: Edit Restrictions Based on Approval Status
- The system shall allow full editing of orders with "Draft" status
- The system shall allow full editing of orders with "Pending Approval" status
- The system shall lock all editing capabilities for orders with "Approved" status
- The system shall display a clear visual indicator when an order is locked from editing
- The system shall prevent changes to approved orders unless the status is first reverted to "Draft" or "Pending Approval"

### FR-4: Google Sheets Sync Control
- The system shall only sync orders with "Approved" status to Google Sheets
- The system shall prevent syncing of orders with "Draft" or "Pending Approval" status
- The system shall remove orders from Google Sheets if their status changes from "Approved" to a lower status
- The system shall update existing rows in Google Sheets when an approved order is modified (while maintaining approved status)
- The system shall maintain data integrity during status changes that affect sync status

### FR-5: User Interface Updates
- The system shall display the approval status prominently in the order interface
- The system shall provide clear controls to change approval status
- The system shall show appropriate messaging when an order is locked from editing due to approval status
- The system shall display the sequential order ID in place of the previous random ID
- The system shall indicate when an order is eligible for sync to Google Sheets

### FR-6: Settings Configuration
- The system shall reuse existing invoice prefix and starting number settings for order ID generation
- The system shall maintain backward compatibility with existing orders
- The system shall validate that the approval workflow settings are properly configured

## Non-Functional Requirements

### NFR-1: Performance
- The system shall generate the next sequential order ID within 100ms
- The system shall validate order ID uniqueness within 200ms
- The system shall maintain responsive UI during approval status changes
- The system shall maintain existing performance benchmarks for sync operations

### NFR-2: Usability
- The approval status controls shall be intuitive and easily accessible
- The system shall provide clear visual feedback when orders are locked from editing
- Error messages for approval-related restrictions shall be clear and actionable
- The system shall maintain existing user workflows with minimal disruption

### NFR-3: Reliability
- The system shall maintain data integrity during approval status changes
- The system shall handle network interruptions gracefully during sync operations
- The system shall provide recovery mechanisms for failed approval status updates
- The system shall maintain audit logs of all approval status changes

## Acceptance Criteria

1. Sequential order IDs are generated using the configured prefix and starting number
2. Order IDs follow the correct format (prefix + zero-padded sequential number)
3. The next suggested order ID is calculated based on the highest existing ID in the system
4. Three approval statuses are available: "Draft", "Pending Approval", and "Approved"
5. Orders default to "Draft" status when created
6. Full editing is allowed for "Draft" and "Pending Approval" orders
7. Editing is locked for "Approved" orders
8. Only "Approved" orders are synced to Google Sheets
9. Visual indicators show when an order is locked from editing
10. Clear messaging explains why an order cannot be edited
11. Audit trail maintains record of approval status changes
12. Data integrity is maintained throughout the process

## Out of Scope

1. Bulk approval of multiple orders
2. Automated approval workflows based on business rules
3. Email notifications for approval status changes
4. Advanced approval hierarchies with multiple approver levels