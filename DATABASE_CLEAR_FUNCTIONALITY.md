# Database Clear Functionality

This document explains how to use the new database clearing functionality that allows you to clear the local database and the cloud database separately.

## Overview

Two new buttons have been added to the Sync Dashboard that allow you to:

1. **Clear Local Database**: Removes all data from the local IndexedDB database
2. **Clear Cloud Database**: Removes all data from the Supabase cloud database

## Location

The database clear buttons are located in the Sync Dashboard under the "Danger Zone" section.

## Functionality

### Clear Local Database Button
- Clears all data from the local IndexedDB database
- Affects the following tables:
  - Customers
  - Items
  - Orders
  - Settings
  - Stock Adjustments
  - Users
- Resets the in-memory cache
- Does NOT affect the cloud database

### Clear Cloud Database Button
- Clears all data from the Supabase cloud database
- Affects the following tables:
  - Customers
  - Items
  - Orders
  - Settings (resets to default values)
  - Stock Adjustments
  - Users
- Does NOT affect the local database
- Requires valid Supabase credentials to execute

## Safety Measures

Both buttons include:
- Confirmation dialogs to prevent accidental data deletion
- Warning labels indicating the destructive nature of the operations
- Error handling to provide feedback if operations fail
- Toast notifications to confirm successful operations

## Use Cases

### Clear Local Database
- When you want to reset the local application state
- When troubleshooting sync issues
- When starting fresh with a new dataset
- When testing the application with clean data

### Clear Cloud Database
- When you want to reset the cloud database for testing
- When cleaning up test data from the cloud
- When preparing for a fresh data migration
- When troubleshooting cloud sync issues

## Important Notes

⚠️ **WARNING**: These operations are irreversible. All data will be permanently deleted.

🔒 **Security**: The cloud database operations require proper Supabase authentication and RLS policies must allow the operations.

🔄 **Sync Impact**: After clearing either database, you may need to perform a sync operation to bring the databases back in alignment.

## Implementation Details

The functionality is implemented in:
- `components/DatabaseClearButtons.tsx` - The React component with the buttons
- Integrated into `components/SyncDashboard.tsx` - Added to the sync dashboard
- Uses the existing `db` service for local operations
- Uses the existing `supabaseService` for cloud operations
- Fixed to properly handle UUID fields in Supabase by using unconditional delete operations
- Improved settings handling to address Row-Level Security (RLS) policy violations by deleting and re-inserting settings