# Invoice Sync Preservation Fix Specification

## Overview
Fix the issue where draft and non-approved invoices are disappearing after incremental sync operations. The system should preserve local draft orders during sync while ensuring that only approved invoices are pushed to Google Sheets. Additionally, ensure that invoice numbers are properly displayed in the UI instead of order IDs.

## Problem Statement
Currently, when performing an incremental sync, the system replaces all local orders with the data pulled from Google Sheets. This causes draft and non-approved invoices to disappear from the local system. Additionally, the system sometimes displays order IDs instead of proper invoice numbers in various UI components.

## Functional Requirements

### FR-1: Draft Order Preservation During Sync
- The system shall preserve draft orders (approval_status: 'draft') during incremental sync operations
- The system shall preserve pending approval orders (approval_status: 'pending_approval') during incremental sync operations
- The system shall only replace orders that have been marked as 'approved' and 'synced' in the sync process
- The system shall maintain draft orders in the local database even when cloud sync occurs

### FR-2: Selective Order Sync
- The system shall only push orders with 'approved' status to Google Sheets
- The system shall exclude draft and pending approval orders from the sync payload
- The system shall maintain separate sync logic for different approval statuses
- The system shall properly update existing rows in Google Sheets when approved orders are modified

### FR-3: Invoice Number Display
- The system shall display the full invoice number in all UI components instead of truncated versions
- The system shall ensure invoice numbers are properly formatted with prefix and zero-padding
- The system shall maintain consistency between invoice number display in the app and in generated PDFs
- The system shall show the complete invoice number (e.g., VM0001) rather than partial representations

### FR-4: Sync Conflict Handling
- The system shall properly detect conflicts only for synced orders (not draft orders)
- The system shall maintain separate conflict detection logic for different approval statuses
- The system shall preserve draft order data during conflict resolution processes
- The system shall ensure that conflict resolution doesn't affect non-synced orders

### FR-5: Data Integrity
- The system shall maintain referential integrity between customers and preserved draft orders
- The system shall ensure that draft orders remain accessible in the UI after sync operations
- The system shall maintain proper status tracking for all order approval states
- The system shall prevent data corruption during sync operations

## Non-Functional Requirements

### NFR-1: Performance
- The system shall maintain the same sync performance as before the fix
- The selective sync logic shall not significantly increase sync operation time
- The system shall continue to process sync operations within existing time limits

### NFR-2: Usability
- The user interface shall clearly indicate the approval status of each order
- Users shall be able to distinguish between draft, pending approval, and approved orders
- The invoice display shall be consistent across all views and reports
- Error messages shall clearly indicate when sync operations affect specific order statuses

### NFR-3: Reliability
- The system shall maintain data integrity during sync operations
- The system shall handle network interruptions gracefully without losing draft orders
- The system shall provide recovery mechanisms for failed sync operations
- The system shall maintain audit trails for all sync-related activities

## Acceptance Criteria

1. Draft orders remain in the local system after incremental sync operations
2. Only approved orders are sent to Google Sheets during sync
3. Invoice numbers are displayed in full format (e.g., VM0001) in all UI components
4. The sync process properly distinguishes between different approval statuses
5. Conflict detection only applies to synced orders, not draft orders
6. Data integrity is maintained throughout the sync process
7. Users can continue working with draft orders after sync operations
8. The system properly updates existing rows in Google Sheets when approved orders change

## Out of Scope

1. Modifying the core sync protocol with Google Sheets
2. Changing authentication mechanisms for Google Sheets access
3. Updating other entity sync behaviors (customers, items)
4. Implementing advanced sync scheduling features