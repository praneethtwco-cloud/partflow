# PartFlow Pro | Enterprise Spare Parts Distribution

PartFlow Pro is a robust, offline-first mobile and web application designed specifically for **Field Sales Representatives** in the vehicle spare parts industry. It transforms your smartphone into a powerful POS terminal, inventory tracker, and customer management tool.

## 🚀 Core Features

### 🛒 Sales & Billing
*   **POS-Style Order Builder:** Rapidly create invoices by searching for parts or scanning SKUs.
*   **Smart Pricing:** Automated calculation of Gross Total, Discounts, and Net Payable.
*   **Payment Management:** Support for Cash, Cheque, Bank Transfer, and Credit. Track partial payments and outstanding balances automatically.
*   **Professional Invoices:** Generate high-quality PDF invoices with your company branding, "PAID IN FULL" stamps, and detailed item breakdowns.

### 📦 Advanced Inventory Control
*   **Smart SKU Generation:** Automatically generates acrostic SKUs (e.g., "Carbon Brush GN125" -> `CBG01`) with auto-incrementing suffixes.
*   **Duplicate Protection:** Prevents accidental entry of the same part/model/country combination.
*   **Flexible Tracking:** 
    *   **Enabled:** Track exact quantities, set low-stock thresholds, and receive automated alerts.
    *   **Disabled:** Use manual "In Stock / Out of Stock" flagging for a simplified workflow.
*   **Vehicle-Centric UX:** Powerful filters for **Vehicle Model**, **Country of Origin**, and **Category**.

### 👤 Customer (Shop) Management
*   **Shop Profiles:** Drill down into specific customer histories, outstanding credit lists, and settlement journals.
*   **Credit Tracking:** Real-time visibility of total due amounts directly in the shop list.
*   **Quick Actions:** Tap a shop to instantly create a new bill or view their profile.

### 📊 Business Intelligence
*   **Dynamic Dashboard:** Daily/Monthly sales snapshots and critical stock alerts.
*   **Reporting Suite:** 
    *   **Sales Journal:** Detailed transaction history with period filtering.
    *   **Inventory Health:** Reports on "Out of Stock" items vs "Available" stock.
    *   **Category Analytics:** Understand which part categories drive your revenue.
*   **PDF Export:** All reports can be exported as professional PDFs for HQ.

### 📱 Enterprise-Grade Mobile UX
*   **Offline-First:** Powered by **IndexedDB (Dexie.js)**. Work anywhere without an internet connection; data stays on your device.
*   **Cloud Sync:** Bidirectional sync with **Supabase**. Pull inventory updates and push sales records with one tap.
*   **Android Support:** Fully compiled for Android with a **Native Home Screen Widget** showing today's sales.
*   **Navigation:** Smart back-button history and themed safety modals.

---

## 🛠 Setup & Technical Configuration

### 1. Requirements
*   Node.js (v18+)
*   Capacitor CLI (for Android)
*   A Google Sheet ID (for cloud sync)

### 2. Installation
```bash
npm install
npm run build
```

### 3. Supabase Integration
1.  Configure your Supabase project credentials in the environment variables.
2.  Ensure your Supabase database has the required tables: `items`, `customers`, `orders`, and `stock_adjustments`.
3.  Set up Row Level Security (RLS) policies for data protection.

### 4. Android Build
```bash
npm run sync
npx cap open android
```

---

## ⚙️ Customization (Settings)
Access the **Settings** tab to tailor the app to your business:
*   **Currency Symbol:** Set globally ($, Rs., €, etc.).
*   **Auto-SKU:** Toggle automatic SKU generation logic.
*   **Stock Tracking:** Enable or disable quantity management.
*   **Item Category:** Simplify the UI by hiding categories if not needed.
*   **Bill Head:** Customize Company Name, Address, and Invoice Prefix.

---

## 🛡️ Security & Privacy
*   **Local Storage:** All customer and sales data is stored locally on the device.
*   **Manual Backups:** The app automatically generates a CSV backup of your inventory before every sync.

---
*Developed for Enterprise Distribution Management.*
