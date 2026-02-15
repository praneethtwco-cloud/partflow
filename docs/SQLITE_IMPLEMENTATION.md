# SQLite Implementation for Capacitor Android

This document describes the implementation of SQLite for the Capacitor Android app while maintaining IndexedDB for the web interface.

## Overview

PartFlow Pro uses a dual-database strategy:
- **Web (Browser)**: IndexedDB via Dexie.js (existing)
- **Android/iOS (Native)**: SQLite via `@capacitor-community/sqlite`

## Architecture

### Database Abstraction Layer

```
┌─────────────────────────────────────┐
│         Application Code            │
│   (imports from services/database) │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│     services/database.ts            │
│  (Factory - Platform Detection)    │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
        ▼             ▼
┌──────────────┐ ┌──────────────────┐
│ services/db  │ │services/sqlite-db│
│  (Dexie.js)  │ │ (@capacitor-     │
│    Web       │ │ community/sqlite)│
│              │ │   Android/iOS    │
└──────────────┘ └──────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `services/database.ts` | Factory that selects the appropriate database based on platform |
| `services/sqlite-db.ts` | SQLite implementation mirroring the Dexie API |
| `services/db.ts` | Existing Dexie.js implementation (unchanged) |
| `capacitor.config.ts` | Plugin configuration |

## Platform Detection

The database factory uses Capacitor's platform detection:

```typescript
import { Capacitor } from '@capacitor/core';

const platform = Capacitor.getPlatform();
// Returns: 'web' | 'android' | 'ios' | 'electron'
```

## Data Synchronization

### Initial Sync Strategy

On first launch of the Android app:
1. App checks if SQLite database is empty
2. If empty, triggers sync from Supabase
3. Data is loaded directly from cloud, not migrated from IndexedDB

This ensures:
- Fresh, consistent data on new installs
- No dependency on web browser data
- Cloud-first approach for mobile

## Usage

### Import the Database

```typescript
// For most use cases - automatically selects the right database
import { db } from '@/services/database';

// Or get the platform-specific instance
import { getDatabase, initializeDatabase, getDatabasePlatform } from '@/services/database';

// Initialize on app startup
await initializeDatabase();
```

### Available Methods

Both database implementations expose the same API:

```typescript
// Customers
db.getCustomers(): Customer[]
await db.saveCustomer(customer: Customer): Promise<void>
await db.deleteCustomer(customerId: string): Promise<void>

// Items
db.getItems(): Item[]
await db.saveItem(item: Item): Promise<void>
await db.deleteItem(itemId: string): Promise<void>
await db.updateStock(itemId: string, qtyDelta: number): Promise<void>

// Orders
db.getOrders(): Order[]
await db.saveOrder(order: Order): Promise<void>
await db.deleteOrder(orderId: string): Promise<void>
await db.addPayment(payment: Payment): Promise<void>
await db.updateDeliveryStatus(orderId: string, status: string, notes?: string): Promise<void>

// Settings
db.getSettings(): CompanySettings
await db.saveSettings(settings: CompanySettings): Promise<void>

// Stats
db.getSyncStats(): SyncStats
db.getDashboardStats(): DashboardStats
```

## Development Workflow

### Web Development
```bash
npm run dev     # Uses IndexedDB via Dexie.js
```

### Android Development
```bash
npm run sync    # Build and sync to Android
npx cap open android  # Open Android Studio
```

### Testing in Browser (Android mode)
The SQLite plugin supports web mode via `npx cap serve`, but this uses a web-based SQLite implementation (sql.js). For full native testing, always build and run on a device/emulator.

## Build Commands

```bash
# Development
npm run dev                # Web with IndexedDB

# Build & Deploy
npm run build              # Build for production
npm run sync               # Build and sync to Android (Capacitor)

# Android
npx cap open android       # Open Android Studio
npx cap run android        # Run on Android device/emulator
```

## Configuration

### capacitor.config.ts

```typescript
const config: CapacitorConfig = {
  appId: 'com.partflow.pro',
  appName: 'PartFlow Pro',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      androidDatabaseName: 'PartFlowDB.db'
    }
  }
};
```

### Dependencies

- `@capacitor-community/sqlite@^8.0.0` - Already installed
- `@capacitor/core@^8.0.2` - Already installed

## Troubleshooting

### Database not initializing
1. Ensure `npx cap sync` has been run after installation
2. Check Android logcat for SQLite errors
3. Verify the database file is created: `/data/data/com.partflow.pro/databases/PartFlowDB.db`

### Sync not working
1. Check Supabase credentials are configured
2. Verify network connectivity
3. Check sync queue in console logs

## Future Enhancements

- Add database encryption for production
- Implement incremental sync (only changed records)
- Add migration support for schema updates
- Consider using TypeORM for better query management
