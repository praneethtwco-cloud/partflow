# PartFlow Pro - Enterprise Spare Parts Distribution System

## Project Overview

PartFlow Pro is a comprehensive, offline-first mobile and web application designed specifically for Field Sales Representatives in the vehicle spare parts industry. It transforms smartphones into powerful POS terminals, inventory trackers, and customer management tools. The application is built with React, TypeScript, and Dexie.js for offline capabilities, with cloud synchronization via Google Sheets API.

### Key Features
- **POS-Style Order Builder**: Rapidly create invoices by searching for parts or scanning SKUs
- **Advanced Inventory Control**: Smart SKU generation, duplicate protection, flexible tracking
- **Customer Management**: Shop profiles with credit tracking and payment history
- **Business Intelligence**: Dynamic dashboard with sales snapshots and critical stock alerts
- **Offline-First Architecture**: Powered by IndexedDB (Dexie.js) for operation without internet
- **Cloud Sync**: Bidirectional sync with Google Sheets
- **Mobile Support**: Android app via Capacitor with native home screen widget

### Tech Stack
- **Frontend**: React 19.2.4 + TypeScript 5.8.2
- **Build Tool**: Vite 6.2.0
- **Database**: Dexie.js (IndexedDB wrapper) for offline storage
- **Mobile**: Capacitor for Android packaging
- **Backend**: Flask (Python) with Google Sheets API
- **Styling**: Tailwind CSS
- **PDF Generation**: jsPDF with autotable
- **Deployment**: Vercel (frontend) + Serverless functions (backend)

## Building and Running

### Prerequisites
- Node.js (v18+)
- Capacitor CLI (for Android builds)
- Google Sheet ID for cloud sync

### Installation
```bash
npm install
npm run build
```

### Development
```bash
npm run dev
```

### Android Build
```bash
npm run sync  # Builds and syncs with Capacitor
npx cap open android
```

### Environment Variables
- `VITE_API_KEY`: Secure backend access key
- `JWT_SECRET`: Secret for token signing
- `GOOGLE_SERVICE_ACCOUNT_B64`: Base64 encoded GCP credentials
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: Supabase database connection credentials

## Development Conventions

### Code Structure
- **Components**: Located in `components/` directory with feature-specific subdirectories
- **Services**: Business logic in `services/` (db.ts, sheets.ts, pdf.ts)
- **Utils**: Helper functions in `utils/` directory
- **Context**: React Context providers in `context/` for global state
- **API**: Python Flask backend in `api/` directory

### Database Schema
- **Customers**: customer_id, shop_name, sync_status
- **Items**: item_id, item_number, item_display_name, sync_status
- **Orders**: order_id, customer_id, order_date, sync_status
- **Settings**: id (singleton for company profile)
- **Users**: id, username (for authentication)

### State Management
- Uses React Context for authentication, toast notifications, and theme management
- Dexie.js for offline-first data persistence
- In-memory caching layer for improved performance

### Sync Strategy
- Bidirectional sync with Google Sheets
- Conflict resolution with "last-write-wins" approach
- Automatic CSV backup before sync operations
- Pending/synced status tracking for offline capability

## Project Architecture

### Frontend Architecture
The frontend follows a component-based architecture with clear separation of concerns:
- Layout components manage the overall app structure
- Feature components handle specific business domains (customers, inventory, orders)
- UI components provide reusable elements (modals, forms)
- Services encapsulate business logic and data operations

### Backend Architecture
The backend is built with Flask and provides:
- Authentication endpoints (login, register, password change)
- Sync endpoints for bidirectional data exchange with Google Sheets
- Health check endpoint
- Rate limiting and security measures

### Data Flow
1. User interacts with the UI
2. Components update local state and database via service layer
3. Changes are marked as "pending" for sync
4. When online, pending changes are synchronized with Google Sheets
5. Cloud data is pulled and merged with local data
6. UI reflects updated state

## Key Components

### Core Modules
- **Layout**: Manages navigation and app structure
- **CustomerList**: Displays and manages customer/shop profiles
- **InventoryList**: Shows available inventory with filtering options
- **OrderBuilder**: POS-style interface for creating orders
- **SyncDashboard**: Controls cloud synchronization
- **InvoicePreview**: Generates professional PDF invoices
- **Reports**: Business intelligence and analytics

### Context Providers
- **AuthContext**: Manages user authentication state
- **ToastContext**: Handles notification messages
- **ThemeContext**: Manages application theme

### Services
- **db.ts**: Dexie database operations and sync orchestration
- **sheets.ts**: Google Sheets API communication
- **pdf.ts**: Invoice PDF generation