# Track Specification: Fully Cloud-Based App with Supabase Integration

## Overview
This track focuses on restructuring the Akila Node application to be fully cloud-based with Supabase as the primary database. The current manual sync mechanism will be removed and replaced with an automated system that handles offline data queuing and synchronization when online. Additionally, a CSV import mechanism will be implemented to allow users to migrate existing data.

## Functional Requirements

### 1. Supabase Integration
- Replace current Dexie.js/SQLite database with Supabase as the primary data store
- Implement real-time data synchronization between client and Supabase
- Migrate all existing data types (customers, inventory, orders, settings, reports) to Supabase

### 2. Offline Queue System
- Implement a local queue system to store pending changes when offline
- Queue operations include create, update, and delete operations
- Automatically sync queued operations when connectivity is restored
- Handle conflict resolution using last-write-wins approach

### 3. CSV Import Mechanism
- Provide a CSV upload interface for bulk data import
- Supply users with correct CSV templates for each data type
- Validate CSV format and content before importing
- Transform CSV data to match Supabase schema
- Handle import errors gracefully with clear feedback

### 4. Authentication & Authorization
- Implement Supabase authentication system
- Migrate existing user accounts to Supabase authentication
- Set up proper RLS (Row Level Security) policies

### 5. Data Migration
- Develop a migration pathway for existing data to Supabase
- Ensure data integrity during the migration process
- Provide tools for users to verify successful migration

## Non-Functional Requirements
- Maintain application performance despite cloud-based architecture
- Ensure data security and privacy compliance
- Provide clear feedback to users during sync operations
- Maintain backward compatibility where possible during transition

## Acceptance Criteria
- Manual sync button is removed from the UI
- All data operations happen seamlessly with Supabase
- Offline changes are queued and synced automatically when online
- CSV import functionality works reliably with provided templates
- Conflict resolution follows the last-write-wins approach
- All existing data is accessible in Supabase
- Application maintains responsive performance

## Out of Scope
- Changing the core business logic of the application
- Modifying the UI/UX beyond what's necessary for the new sync mechanism
- Implementing additional features not related to the cloud migration