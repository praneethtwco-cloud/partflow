# PartFlow Pro - Agent Development Guide

**Project**: Enterprise Spare Parts Distribution Management System  
**Tech Stack**: React 19.2.4 + TypeScript 5.8.2 + Vite 6.2.0 + Capacitor 8.0.2 + Dexie.js 4.3.0 + PWA  
**Platform**: Web PWA + Android App  
**Deployment**: Vercel (Frontend) + Local API (Flask)

**Key Dependencies**:
- React 19.2.4 with React DOM
- Dexie.js 4.3.0 for IndexedDB operations  
- Capacitor 8.0.2 for Android packaging
- jsPDF 4.0.0 with autotable for PDF generation
- html5-qrcode 2.3.8 for barcode scanning
- Lucide React 0.563.0 for icons
- Recharts 3.7.0 for data visualization

---

## 📋 Build, Lint & Test Commands

### Frontend (React + Vite)
```bash
# Development
npm run dev                # Start development server (http://localhost:3000)

# Build & Deploy  
npm run build              # Build for production
npm run preview           # Preview production build locally
npm run sync              # Build and sync to Android (Capacitor)

# Package Management
npm install               # Install dependencies
npm ci                   # Clean install for CI/CD
```

**Note**: No linting or testing framework currently configured. Recommend adding:
```bash
# Recommended additions
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier
npm install --save-dev @testing-library/react @testing-library/jest-dom vitest jsdom
```

### Android Development
```bash
npm run sync             # Build and sync to Android
npx cap open android     # Open Android Studio
npx cap run android      # Run on Android device/emulator
```

---

## 🏗️ Project Architecture

### Frontend Structure
- **Entry Point**: `App.tsx` - Main application with tab navigation and state management
- **Components**: `components/` - Reusable UI components and feature modules
- **Services**: `services/` - Business logic (database, sheets API, PDF generation)
- **Utils**: `utils/` - Helper functions (currency, CSV, UUID generation)
- **Types**: `types.ts` - TypeScript interfaces and type definitions
- **Context**: `context/` - React context providers (Auth, Theme, Toast)

### Backend Structure  
- **Main API**: `api/index.py` - Flask application with CORS and rate limiting
- **Auth Service**: `api/auth_service.py` - User authentication and password management
- **Database**: `api/database.py` - Google Sheets integration and data operations
- **Utils**: `api/utils.py` - Google Sheets API service and configuration

### Data Layer
- **Local Storage**: IndexedDB via Dexie.js for offline-first functionality
- **Cloud Sync**: Google Sheets API for bidirectional data synchronization
- **Tables**: `customers`, `items`, `orders`, `payments`, `stock_adjustments`

---

## 🎨 Code Style Guidelines

### TypeScript & React
- **Framework**: React 19.2.4 with functional components and hooks
- **TypeScript**: Strict mode enabled with comprehensive type definitions in `types.ts`
- **Component Pattern**: Functional components with explicit prop interfaces
- **State Management**: React hooks for local state, context for global state
- **Routing**: Tab-based navigation with history stack management
- **Path Aliases**: `@/*` configured in both tsconfig.json and vite.config.ts for clean imports

### Import Organization
```typescript
// External libraries first
import React, { useState, useEffect } from 'react';
import Dexie, { Table } from 'dexie';

// Internal imports (use absolute paths with @ alias)
import { Customer, Order } from '../types';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
```

### Component Structure
```typescript
interface ComponentProps {
  // Props with clear TypeScript types
  data: Item[];
  onAction: (id: string) => void;
}

export const Component: React.FC<ComponentProps> = ({ data, onAction }) => {
  // Hooks first
  const { themeClasses } = useTheme();
  const [state, setState] = useState<Type>(initialValue);
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  // Event handlers
  const handleClick = () => {
    // Handler logic
  };
  
  // Render
  return (
    <div className={themeClasses.container}>
      {/* JSX content */}
    </div>
  );
};
```

### Naming Conventions
- **Components**: PascalCase with descriptive names (`OrderBuilder`, `CustomerList`)
- **Variables**: camelCase with semantic meaning (`outstanding_balance`, `sync_status`)
- **Types/Interfaces**: PascalCase (`Customer`, `Order`, `PaymentType`)
- **Constants**: UPPER_SNAKE_CASE for configuration (`STORAGE_KEYS`, `API_ENDPOINTS`)
- **Files**: kebab-case for components, camelCase for utilities (`order-builder.tsx`, `currency.ts`)

### Database & API Patterns
- **Dexie.js**: Use service layer pattern in `services/db.ts`
- **Type Safety**: All database operations must use TypeScript interfaces
- **Error Handling**: Try-catch blocks with user-friendly error messages via Toast context
- **Async Operations**: Always use async/await, never chain `.then()`
- **Batch Operations**: Use transactions for multiple related updates

### Styling & UI
- **CSS Framework**: Tailwind CSS (utility-first approach)
- **Theming**: Dynamic theming via `ThemeContext` with CSS classes
- **Responsive**: Mobile-first design with touch-friendly interactions
- **Modals**: Use `Modal` component from `components/ui/Modal.tsx`
- **Loading States**: Skeleton components in `components/ui/skeletons/`

