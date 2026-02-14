# Tech Stack

## Frontend
- **Framework**: React + TypeScript
- **UI Library**: Tailwind CSS
- **State Management**: Context API / Redux (as needed)
- **Build Tool**: Vite
- **Invoice Numbering**: Sequential numbering system with configurable prefix and starting number
- **Sync Tracking**: Enhanced order model with original_invoice_number tracking for Supabase updates
- **Invoice Editing**: Capability to edit synced invoices with proper record replacement in Supabase
- **Primary Identifier**: Invoice number used as primary identifier replacing order ID
- **Edit Preservation**: Order ID preserved when editing existing invoices to prevent creation of new records
- **Sync Preservation**: Draft and non-approved invoices preserved during sync operations to prevent data loss
- **Invoice Display**: Full invoice numbers displayed consistently throughout the application
- **Local Storage**: Draft orders maintained in local storage during incremental Supabase sync
- **Sync Logic**: Fixed variable scoping issues in sync operations to prevent runtime errors

## Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (for local storage) / PostgreSQL (for production)

## Mobile
- **Framework**: Capacitor (for native mobile app packaging)

## Database
- **Primary**: Dexie.js (IndexedDB wrapper for browser storage)
- **Cloud**: Supabase (PostgreSQL) with real-time synchronization
- **Alternative**: SQLite for offline capabilities

## APIs
- **External Integrations**: Supabase API
- **Serverless Functions**: For backend operations

## Data Import/Export
- **CSV Parsing**: PapaParse library for CSV import/export functionality
- **CSV Templates**: Predefined templates for different data types (customers, items, orders, settings)
- **Data Validation**: Client-side validation for CSV import operations

## Development Tools
- **Language**: TypeScript
- **Package Manager**: npm
- **Testing**: Jest / React Testing Library
- **Linting**: ESLint + Prettier