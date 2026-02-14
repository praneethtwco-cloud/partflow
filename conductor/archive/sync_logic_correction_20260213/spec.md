# Sync Logic Correction Specification

## Overview
Fix the sync logic that was causing draft orders to disappear during incremental sync operations. Correct the variable scoping issue where `localDraftOrders` was not defined in the sync process. Ensure that draft and non-approved orders are properly preserved during sync operations while maintaining data integrity.

## Problem Statement
The sync logic in the database service had a critical bug where the variable `localDraftOrders` was referenced but not defined in the scope where it was used. This caused sync operations to fail with a "localDraftOrders is not defined" error. Additionally, the logic for preserving draft orders during sync was not correctly implemented.

## Functional Requirements

### FR-1: Variable Scoping Fix
- The system shall define the `localPreservedOrders` variable in the correct scope for the sync operation
- The system shall ensure the variable is accessible within the database transaction
- The system shall maintain the same filtering logic for identifying orders to preserve
- The system shall properly reference the correctly scoped variable in all operations

### FR-2: Draft Order Preservation
- The system shall preserve orders with 'draft' approval status during sync operations
- The system shall preserve orders that have not been synced yet (sync_status !== 'synced')
- The system shall maintain these orders in the local database during incremental sync
- The system shall ensure these orders remain accessible to the user after sync

### FR-3: Sync Operation Continuity
- The system shall continue to properly sync approved orders to Google Sheets
- The system shall maintain the integrity of synced data during the operation
- The system shall not interfere with the existing sync workflow for approved orders
- The system shall properly update the cache after sync operations

### FR-4: Error Prevention
- The system shall prevent "variable not defined" errors during sync operations
- The system shall handle edge cases where no draft orders exist
- The system shall provide graceful degradation if sync operations partially fail
- The system shall maintain logging for debugging sync operations

## Non-Functional Requirements

### NFR-1: Performance
- The system shall maintain the same sync performance as before the fix
- The additional filtering logic shall not significantly impact sync operation time
- The system shall continue to process sync operations within existing time limits

### NFR-2: Reliability
- The system shall handle the sync operation without runtime errors
- The system shall maintain data integrity during the sync process
- The system shall provide recovery mechanisms for failed sync attempts
- The system shall preserve existing functionality while fixing the bug

### NFR-3: Maintainability
- The code shall follow existing patterns and conventions in the codebase
- The fix shall be easily understandable by other developers
- The logic shall be properly documented with comments
- The implementation shall be consistent with the overall architecture

## Acceptance Criteria

1. The "localDraftOrders is not defined" error no longer occurs during sync operations
2. Draft orders remain in the local system after incremental sync operations
3. Only approved orders are subject to replacement from cloud data during sync
4. The sync process correctly identifies which orders to preserve vs. which to update
5. All existing sync functionality continues to work as expected
6. Data integrity is maintained throughout the sync process
7. The system properly updates the cache after sync operations
8. Error logging continues to work properly during sync operations

## Out of Scope

1. Changing the core sync protocol with Google Sheets
2. Modifying authentication mechanisms for Google Sheets access
3. Updating other entity sync behaviors (customers, items)
4. Implementing new sync scheduling features