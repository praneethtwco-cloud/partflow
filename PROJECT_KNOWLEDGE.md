# PartFlow Pro - Project Knowledge Base

**Last Updated**: February 11, 2026
**Project Type**: Enterprise Spare Parts Distribution Management System
**Tech Stack**: React + TypeScript + Dexie.js + Flask (Serverless) + Google Sheets API
**Platform**: Web (PWA) + Android (Capacitor)
**Deployment**: Vercel (Frontend + Backend)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technical Architecture](#technical-architecture)
3. [Core Features](#core-features)
4. [File Structure](#file-structure)
5. [Database Schema](#database-schema)
6. [Data Flow](#data-flow)
7. [Key Components](#key-components)
8. [Backend API](#backend-api)
9. [Deployment](#deployment)
10. [Configuration](#configuration)
11. [Roadmap](#roadmap)

---

## Project Overview

### Purpose
PartFlow Pro transforms smartphones into powerful POS terminals for field sales representatives in the vehicle spare parts industry. It provides offline-first inventory management, customer relationship tracking, and cloud synchronization with headquarters.

### Key Value Propositions
1.  **Work Offline**: All operations function without internet connection (Dexie.js).
2.  **Instant Invoicing**: Generate professional PDF invoices on-site with logo branding.
3.  **Real-time Inventory**: Track stock levels with low-stock alerts.
4.  **Credit Management**: Monitor customer outstanding balances.
5.  **Smart Sync**: Bidirectional sync with Google Sheets including conflict resolution.
6.  **Secure**: JWT authentication and role-based access.

---

## Technical Architecture

### Frontend Stack
```
React 19.2.4 (UI Framework)
├── TypeScript 5.8.2 (Type Safety)
├── Vite 6.2.0 (Build Tool)
├── Dexie 4.3.0 (IndexedDB Wrapper - Offline DB)
├── Capacitor 8.0.2 (Mobile Platform)
├── jsPDF 4.0.0 (PDF Generation)
└── Tailwind CSS (Styling)
```

### Backend Stack
```
Flask 3.0.2 (Python Web Framework)
├── Google Sheets API v4 (Cloud Database)
├── PyJWT + bcrypt (Security)
└── Vercel (Serverless Deployment)
```

### Security
- **Authentication**: JWT (JSON Web Tokens) with 24h expiry.
- **Password Storage**: bcrypt hashing (rounds=12).
- **API Security**: Secrets loaded from environment variables (no hardcoded keys).
- **Headers**: CSP, HSTS, X-Frame-Options configured in `vercel.json`.
- **Protection**: Rate limiting (Flask-Limiter) and CORS restrictions.

---

## Core Features

### ✅ Sales & Billing
- **POS Order Builder**: Real-time item search, SKU scanning, dual discounts.
- **Professional Invoices**: PDF generation with company logo.
- **Payment Tracking**: Partial payments, credit tracking.

### ✅ Inventory Control
- **Smart SKU**: Auto-generates SKUs (e.g., "Brake Pad" -> `BP01`).
- **Conflict Resolution**: "Smart Sync" detects if records changed on both server and client.
- **Stock Adjustments**: Log damage, returns, or corrections.

### ✅ Cloud Synchronization
- **Modes**: Upsert (default) or Overwrite.
- **Conflict UI**: Side-by-side comparison for conflicting records.
- **Backup**: Auto-CSV backup before sync.

---

## File Structure

```
D:\AA AKILA NODE\
├── 📱 src/
│   ├── components/      # React UI Components
│   │   ├── ui/          # Shared (Modal, ConflictResolver)
│   │   └── ...          # Feature components (OrderBuilder, etc.)
│   ├── services/        # Logic Layer
│   │   ├── db.ts        # Dexie DB + Sync Orchestration
│   │   ├── supabase.ts  # Supabase Client
│   │   └── pdf.ts       # PDF Generation
│   ├── utils/           # Helpers (formatting, validation)
│   └── context/         # React Context (Auth, Toast, Theme)
│
└── 📦 config/           # Build Configs
    ├── vite.config.ts
    ├── vercel.json      # Deployment Rules
    └── tailwind.config.js
```

---

## Database Schema (IndexedDB)

**Customers**: `customer_id, shop_name, sync_status`
**Items**: `item_id, item_number, item_display_name, sync_status`
**Orders**: `order_id, customer_id, order_date, sync_status`
**Settings**: `id` (singleton for company profile, logo)
**Users**: `id, username` (local cache of auth)

---

## Deployment

### Frontend Only (Vercel)
The project uses a frontend-only architecture with Supabase for data and auth.
- **Frontend**: Built via `npm run build` -> served from `dist/`
- **Data**: Supabase (PostgreSQL + Auth)
- **Offline**: IndexedDB via Dexie.js with Supabase sync

### Commands
```bash
npm run build           # Production build
vercel deploy          # Deploy to Vercel
npm run sync           # Build & sync to Android
```

### Environment Variables
- `SUPABASE_URL` and `SUPABASE_ANON_KEY`: Supabase database connection credentials

---

## Roadmap

### Completed (Phase 1 & 2)
- [x] Offline Architecture
- [x] POS & Invoicing
- [x] Google Sheets Sync
- [x] Conflict Resolution UI
- [x] Logo Upload
- [x] JWT Authentication
- [x] Deployment Config

### Future (Phase 3)
- [ ] **Forgot Password Flow** (Email integration)
- [ ] **Bulk Imports**: CSV import for inventory
- [ ] **Reporting**: Graphical charts (Chart.js)
- [ ] **Multi-Currency**: Exchange rate support
