# Track: Supabase Integration Specification

## Overview
Replace the current Google Sheets integration with Supabase as the primary data storage and synchronization mechanism. The implementation will support both offline and online functionality using Dexie.js (IndexedDB wrapper) for local storage and Supabase Realtime for synchronization.

## Functional Requirements

### 1. Supabase Setup and Configuration
- Set up Supabase project with PostgreSQL database
- Configure authentication system for user management
- Implement Row Level Security (RLS) policies for data protection
- Set up Realtime functionality for live data synchronization

### 2. Offline Storage Implementation
- Integrate Dexie.js as the local storage solution
- Create local database schema mirroring Supabase tables
- Implement mechanisms to store data locally when offline
- Ensure all data entities (customers, inventory, orders, users, settings) can be stored offline

### 3. Online/Offline Synchronization
- Implement bidirectional sync between local Dexie.js database and Supabase
- Use Supabase Realtime to detect and propagate changes
- Handle connection status detection (online/offline)
- Queue local changes for sync when connection is restored

### 4. Conflict Resolution
- Implement "last-write-wins" conflict resolution strategy
- Log conflicts for monitoring and debugging purposes
- Ensure data integrity during conflict resolution

### 5. Data Entities to Synchronize
- Customer information (customer_id, shop_name, contact details, etc.)
- Inventory items (item_id, item_number, item_display_name, stock levels, etc.)
- Orders/invoices (order_id, customer_id, items, totals, status, etc.)
- User accounts and authentication data
- Settings and configuration data

### 6. Migration from Google Sheets
- Develop migration script to transfer existing data from Google Sheets to Supabase
- Ensure data integrity during migration
- Maintain backward compatibility during transition period
- Remove Google Sheets dependencies after successful migration

## Non-Functional Requirements

### 1. Performance
- Local operations must remain fast even when offline
- Sync operations should be efficient and not block UI
- Optimize queries for both local and remote databases

### 2. Security
- Implement proper authentication and authorization
- Encrypt sensitive data in transit and at rest
- Follow Supabase security best practices

### 3. Reliability
- Handle network failures gracefully
- Ensure data consistency between local and remote databases
- Implement proper error handling and recovery mechanisms

### 4. Scalability
- Design schema to accommodate growth in data volume
- Optimize for concurrent access patterns
- Plan for increasing number of users

## Acceptance Criteria

1. Application can operate fully offline with all core functionality available
2. Data changes made offline are automatically synchronized when online
3. Data changes made online are reflected in the offline storage
4. Conflict resolution works according to the last-write-wins strategy
5. All data entities (customers, inventory, orders, users, settings) are properly synchronized
6. Google Sheets integration is completely removed from the codebase
7. Existing data is successfully migrated from Google Sheets to Supabase
8. Performance benchmarks meet or exceed current levels
9. Authentication and security requirements are met
10. Error handling and recovery mechanisms work as expected

## Out of Scope

1. Implementing additional Supabase features beyond Realtime and basic storage
2. Changing the frontend UI/UX (implementation should be transparent to users)
3. Modifying existing business logic unrelated to data storage and sync
4. Adding new features beyond the scope of database integration