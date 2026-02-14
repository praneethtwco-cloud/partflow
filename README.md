# PartFlow Pro

**Enterprise Spare Parts Distribution Management System**

PartFlow Pro is a comprehensive inventory and sales management solution designed for spare parts distributors. It features offline-first architecture, real-time cloud synchronization, multi-platform support (Web PWA + Android), and an intuitive interface for managing customers, inventory, orders, and invoicing.

[![React](https://img.shields.io/badge/React-19.2.4-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF.svg)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.0.2-119EFF.svg)](https://capacitorjs.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 📋 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Synchronization](#synchronization)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## ✨ Features

### 🛒 Sales & Order Management

- **POS-Style Order Builder**
  - Rapid invoice creation with real-time search
  - Barcode scanning support (camera-based)
  - Smart pricing with automatic calculations
  - Multi-level discount application (Primary & Secondary)
  - Tax calculation and handling

- **Professional Invoicing**
  - Sequential invoice numbering with custom prefix
  - High-quality PDF generation
  - Company branding with logo support
  - "PAID IN FULL" stamps for completed payments
  - Detailed item breakdowns with discounts

- **Payment Management**
  - Multiple payment methods: Cash, Cheque, Bank Transfer, Credit
  - Partial payment support with balance tracking
  - Real-time payment status updates
  - Outstanding balance monitoring per customer

### 📦 Inventory Control

- **Smart SKU Generation**
  - Automatic acrostic SKU creation (e.g., "Carbon Brush GN125" → `CBG01`)
  - Auto-incrementing suffixes for duplicates
  - Duplicate protection for same part/model combinations

- **Advanced Tracking**
  - Real-time stock quantity monitoring
  - Low stock threshold alerts
  - Out-of-stock indicators
  - Vehicle model categorization
  - Brand/Origin tracking
  - Category-based organization

- **Flexible Modes**
  - **Enabled:** Exact quantity tracking with automated alerts
  - **Disabled:** Simple "In Stock / Out of Stock" flagging

### 👥 Customer Management

- **Comprehensive Profiles**
  - Complete contact information (address, phone, city)
  - Multiple discount levels (discount_rate, discount_1, discount_2)
  - Credit period and limit tracking
  - Outstanding balance monitoring
  - Customer-specific pricing

- **Quick Actions**
  - One-tap order creation from customer list
  - Customer profile with order history
  - Settlement tracking
  - Credit limit warnings

### 🚚 Delivery Management

- **Status Tracking**
  - Pending → Shipped → Out for Delivery → Delivered
  - Failed delivery handling
  - Cancelled order management
  - Delivery notes and documentation

- **Stock Management**
  - Automatic stock deduction on order confirmation
  - Stock restoration for failed/cancelled deliveries
  - Logical transitions prevent double-processing

### ☁️ Cloud Synchronization

- **Bidirectional Sync**
  - Automatic background sync every 5 minutes
  - Manual sync with push/pull capabilities
  - Offline-first with queue management
  - Conflict detection and resolution

- **Supabase Integration**
  - PostgreSQL backend with Row Level Security
  - Real-time data synchronization
  - Secure authentication
  - Anonymous access support for field reps

### 📊 Reporting & Analytics

- **Sales Reports**
  - Date range filtering
  - Revenue calculations with discount tracking
  - Top customers and items analysis
  - Category-wise performance

- **Inventory Reports**
  - Stock health monitoring
  - Low stock alerts
  - Out-of-stock tracking
  - Category distribution

- **Export Capabilities**
  - PDF generation for invoices and reports
  - CSV backup before every sync
  - Professional formatted documents

### 🎨 Customization

- **Company Branding**
  - Logo upload (max 500KB)
  - Company name and address
  - Invoice prefix configuration
  - Footer notes customization

- **Theme Support**
  - Multiple color themes (Indigo, Emerald, Amber, Rose, etc.)
  - Dark/light mode ready
  - Responsive design for all screen sizes

- **Configurable Settings**
  - Tax rates
  - Currency symbols
  - Auto-SKU toggle
  - Stock tracking enable/disable
  - Category display toggle

## 🛠 Technology Stack

### Frontend
- **React 19.2.4** - Modern UI library with hooks
- **TypeScript 5.8.2** - Type-safe development
- **Vite 6.2.0** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React 0.563.0** - Icon library
- **Recharts 3.7.0** - Data visualization

### Mobile & Cross-Platform
- **Capacitor 8.0.2** - Native runtime for iOS/Android
- **Capacitor Community SQLite** - Native mobile database
- **Android SDK** - Native Android support
- **PWA** - Progressive Web App capabilities

### Database & Storage
- **IndexedDB (Dexie.js 4.3.0)** - Browser NoSQL database
- **SQLite** - Native mobile database
- **Supabase** - Cloud PostgreSQL backend
- **LocalStorage** - Session and settings persistence

### Utilities & Libraries
- **jsPDF 4.0.0** - PDF generation
- **jspdf-autotable** - PDF table support
- **html5-qrcode 2.3.8** - Barcode scanning
- **html2canvas** - HTML to image conversion
- **PapaParse** - CSV parsing
- **UUID** - Unique identifier generation

### Backend (Optional)
- **Flask** - Python REST API
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication
  - Real-time subscriptions
  - Row Level Security (RLS)

## 📁 Project Structure

```
partflow-pro/
├── src/                          # Source code
│   ├── components/               # React components
│   │   ├── Login.tsx            # Authentication
│   │   ├── Register.tsx         # User registration
│   │   ├── Layout.tsx           # App layout wrapper
│   │   ├── OrderBuilder.tsx     # Create/edit orders
│   │   ├── OrderHistory.tsx     # View order history
│   │   ├── InvoicePreview.tsx   # Print/preview invoices
│   │   ├── CustomerList.tsx     # Customer management
│   │   ├── ItemList.tsx         # Inventory management
│   │   ├── Reports.tsx          # Analytics dashboard
│   │   ├── SyncDashboard.tsx    # Cloud sync interface
│   │   ├── Settings.tsx         # App configuration
│   │   ├── CsvImportComponent.tsx # CSV data import
│   │   └── DatabaseClearButtons.tsx # Data management
│   ├── context/                  # React contexts
│   │   ├── AuthContext.tsx      # Authentication state
│   │   ├── ThemeContext.tsx     # Theme/color management
│   │   └── ToastContext.tsx     # Notification system
│   ├── services/                 # Business logic
│   │   ├── db.ts                # Database operations (IndexedDB/SQLite)
│   │   ├── supabase.ts          # Supabase client
│   │   ├── supabase-sync-service.ts # Sync logic
│   │   ├── supabase-sync-tracker.ts # Sync tracking
│   │   ├── connection.ts        # Network status monitoring
│   │   ├── auto-sync.ts         # Background sync service
│   │   ├── csv-migration.ts     # CSV data transformation
│   │   └── sync-queue.ts        # Offline sync queue
│   ├── types.ts                 # TypeScript interfaces
│   └── config/                  # Configuration
│       ├── seed-data.json       # Initial demo data
│       └── app-settings.json    # Default settings
├── api/                          # Flask backend (optional)
│   ├── index.py                 # Main API server
│   └── auth_service.py          # Authentication logic
├── android/                      # Android native project
├── supabase-setup.sql           # Database schema
├── vite.config.ts               # Vite configuration
├── capacitor.config.ts          # Capacitor config
├── package.json                 # Dependencies
└── README.md                    # This file
```

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Android Studio (for mobile development)
- Python 3.8+ (for local Flask API - optional)

### Step 1: Clone Repository

```bash
git clone https://github.com/praneeththilina/partflow-pro.git
cd partflow-pro
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Environment Configuration

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 4: Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Step 5: Build for Production

```bash
npm run build
```

### Android App Build

1. **Build and sync with Capacitor**
```bash
npm run sync
```

2. **Open in Android Studio**
```bash
npx cap open android
```

3. **Build APK in Android Studio**
- Build → Build Bundle(s) / APK(s) → Build APK(s)

### Flask Backend (Optional)

```bash
cd api
pip install -r requirements.txt
python index.py
```

Backend will run at `http://localhost:5000`

## 📖 Usage Guide

### First-Time Setup

1. **Access the app** and register as admin or login with credentials
2. **Configure company settings:**
   - Go to Settings tab
   - Set company name, address, phone
   - Upload company logo (max 500KB)
   - Configure invoice prefix and starting number
   - Set tax rates and currency symbol

3. **Initialize inventory:**
   - Go to Items tab
   - Add items manually or import via CSV
   - Configure stock tracking preferences

### Daily Workflow

**1. Managing Inventory**
```
Items Tab → Add New Item
- Enter item details (name, SKU, price)
- Set stock quantity and low threshold
- Assign vehicle model and category
- Save (auto-syncs to cloud if online)
```

**2. Creating Orders**
```
Customers Tab → Select Customer → New Order
- Search items by name or scan barcode
- Add items to cart with quantities
- Apply discounts (primary/secondary)
- Review totals and tax
- Process payment
- Generate invoice
```

**3. Cloud Synchronization**
```
Settings Tab → Data Sync & Tools → Sync & Push
- View pending sync count
- Click "Sync & Push" to upload data
- Automatic background sync runs every 5 minutes
```

### CSV Import Format

**Customers CSV:**
```csv
ID,Shop Name,Address,Phone,City,Discount Rate,Discount 1,Discount 2,Balance,Credit Period,Status,Last Updated
CUST001,ABC Auto Parts,123 Main St,1234567890,New York,0,0,0,0,30,active,2024-01-01
```

**Items CSV:**
```csv
ID,Display Name,Internal Name,SKU,Vehicle,Brand/Origin,Category,Unit Value,Stock Qty,Low Stock Threshold,Out of Stock,Status,Last Updated
ITEM001,Brake Pads Front,Front Brake Pads,BP-001,Toyota,Genuine,Brakes,45.99,50,10,false,active,2024-01-01
```

## 🗄 Database Schema

### Local Database

**Customers Table:**
| Field | Type | Description |
|-------|------|-------------|
| customer_id | string (PK) | Unique identifier |
| shop_name | string | Business name |
| address, phone, city | string | Contact info |
| discount_rate, discount_1, discount_2 | number | Discount percentages |
| outstanding_balance, balance | number | Financial tracking |
| credit_period, credit_limit | number | Credit terms |
| sync_status | enum | pending / synced / conflict |
| created_at, updated_at, last_updated | string | ISO timestamps |

**Items Table:**
| Field | Type | Description |
|-------|------|-------------|
| item_id | string (PK) | Unique identifier |
| item_display_name | string | Display name |
| internal_name | string | Internal reference |
| item_number | string (Unique) | SKU |
| vehicle_model, source_brand, category | string | Classification |
| unit_value | number | Price |
| current_stock_qty, low_stock_threshold | number | Inventory |
| is_out_of_stock | boolean | Stock status |
| sync_status | enum | pending / synced / conflict |

**Orders Table:**
| Field | Type | Description |
|-------|------|-------------|
| order_id | string (PK) | Unique identifier |
| customer_id | string (FK) | Customer reference |
| order_date | string | ISO date |
| lines | array | Order line items |
| discount_rate, discount_value | number | Order discounts |
| tax_rate, tax_value | number | Tax calculations |
| net_total, gross_total | number | Totals |
| paid_amount, balance_due | number | Payment tracking |
| payment_status | enum | paid / partial / unpaid |
| delivery_status | enum | pending / shipped / delivered / failed / cancelled |
| sync_status | enum | pending / synced / conflict |

### Cloud Database (Supabase)

- **PostgreSQL** with Row Level Security
- **Tables:** customers, items, orders, order_lines, users, settings
- **Policies:** Read/Write access for authenticated and anonymous users
- **Triggers:** Auto-update timestamps
- **Indexes:** Optimized for sync_status and common queries

## 🔄 Synchronization

### How It Works

1. **Local Changes**
   - User creates/updates data
   - Record marked with `sync_status: 'pending'`
   - Saved to local IndexedDB/SQLite

2. **Push to Cloud**
   - Sync process identifies pending records
   - Uploads to Supabase via upsert
   - On success, marks as `sync_status: 'synced'`

3. **Pull from Cloud**
   - Fetches all records from Supabase
   - Merges with local data
   - Preserves local pending changes
   - Updates cache

4. **Conflict Resolution**
   - Last write wins (timestamp-based)
   - Local pending changes prioritized
   - Manual resolution available in UI

### Auto-Sync

- Runs every 5 minutes when online
- Triggers on connection restoration
- Respects authentication state
- Queues operations when offline

## 🎨 Customization

### Theming

Access **Settings → Theme** to customize:
- Primary color (Indigo, Emerald, Amber, Rose, etc.)
- Company logo upload
- Dark/light mode support

### Invoice Template

Configure in **Settings → Company Info**:
- Company name and address
- Invoice prefix (e.g., "INV-")
- Starting invoice number
- Footer notes and terms
- Tax rate configuration
- Currency symbol

### Feature Toggles

In **Settings → System Configuration**:
- Auto-Generate SKU
- Inventory Tracking
- Item Categories
- Show SKU in Cards
- Advanced Sync Options

## 🔧 Troubleshooting

### Common Issues

**Sync Not Working**
- Check internet connection
- Verify Supabase credentials in `.env`
- Check browser console for errors
- Ensure RLS policies are configured

**Database Initialization Fails**
```
Solution: Clear browser cache and local storage
1. Open DevTools (F12)
2. Application → Storage → Clear site data
3. Refresh the page
```

**CSV Import Errors**
- Verify column headers match template exactly
- Check for special characters in data
- Ensure dates are in ISO format (YYYY-MM-DD)
- Check file encoding (UTF-8 recommended)

**Build Errors**
```bash
# Clear everything and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Reset Application

To completely reset:
1. Open browser DevTools (F12)
2. Application → Storage → Clear site data
3. Or use: Settings → Clear All Data
4. Refresh the page

## 👥 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- React Team for the amazing UI library
- Capacitor Team for cross-platform capabilities
- Supabase for backend infrastructure
- Tailwind CSS for utility-first styling
- All open-source contributors

---

**Made with ❤️ for spare parts distributors worldwide**

For support, please open an issue on GitHub: https://github.com/praneeththilina/partflow-pro/issues
