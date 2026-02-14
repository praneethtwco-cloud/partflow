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
- Supabase 2.95.3 for cloud sync

---

## Build, Lint & Test Commands

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
npm ci                    # Clean install for CI/CD

# Testing (none configured - see below)
# Once configured with Vitest:
# npm test                 # Run all tests
# npm test -- run SingleFile.test.ts   # Run single file
# npm test -- --watch    # Watch mode
# npm test -- --coverage # Coverage report

# Linting (none configured - see below)
# npm run lint            # Run ESLint (once configured)
```

### Android Development
```bash
npm run sync             # Build and sync to Android
npx cap open android     # Open Android Studio
npx cap run android      # Run on Android device/emulator
```

### Backend (Flask API)
```bash
cd api
pip install -r requirements.txt
python index.py          # Start Flask API server
```

**Note**: No linting or testing framework currently configured. To add:
```bash
# Testing framework (recommended: Vitest)
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
npm install --save-dev @vitejs/plugin-react

# Linting (recommended)
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install --save-dev prettier eslint-config-prettier
```

---

## Project Architecture

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

### Data Layer
- **Local Storage**: IndexedDB via Dexie.js for offline-first functionality
- **Cloud Sync**: Supabase for bidirectional data synchronization with offline support
- **Tables**: `customers`, `items`, `orders`, `payments`, `stock_adjustments`

---

## Code Style Guidelines

### TypeScript & React
- **Framework**: React 19.x with functional components and hooks
- **TypeScript**: Strict mode enabled with comprehensive type definitions in `types.ts`
- **Component Pattern**: Functional components with explicit prop interfaces
- **State Management**: React hooks for local state, context for global state
- **Routing**: Tab-based navigation with history stack management
- **Path Aliases**: `@/*` configured in tsconfig.json and vite.config.ts

### Import Organization (Order: External → Internal)
```typescript
// 1. React and React DOM
import React, { useState, useEffect, useCallback } from 'react';

// 2. Third-party libraries
import Dexie, { Table } from 'dexie';
import { useNavigate } from 'react-router-dom';

// 3. Internal absolute imports (use @ alias)
import { Customer, Order } from '@/types';
import { db } from '@/services/db';
import { useAuth } from '@/context/AuthContext';

// 4. Relative imports for same-module files
import { formatCurrency } from './currency';
```

### Component Structure
```typescript
interface ComponentProps {
  data: Item[];
  onAction: (id: string) => void;
  isLoading?: boolean;
}

export const Component: React.FC<ComponentProps> = ({ data, onAction, isLoading }) => {
  // Hooks first (custom hooks, then state, then refs)
  const { themeClasses } = useTheme();
  const [state, setState] = useState<Type>(initialValue);
  
  // Effects (alphabetically by dependency)
  useEffect(() => {
    // Side effects with proper cleanup
    return () => {
      // Cleanup logic
    };
  }, [dependencies]);
  
  // Event handlers (handleXxx naming)
  const handleClick = useCallback((id: string) => {
    onAction(id);
  }, [onAction]);
  
  // Early returns for loading/error states
  if (isLoading) {
    return <Spinner />;
  }
  
  // Render
  return (
    <div className={themeClasses.container}>
      {data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
};
```

### Naming Conventions
- **Components**: PascalCase (`OrderBuilder`, `CustomerList`, `ItemCard`)
- **Hooks**: camelCase starting with `use` (`useAuth`, `useTheme`)
- **Variables**: camelCase with semantic meaning (`outstandingBalance`, `syncStatus`)
- **Types/Interfaces**: PascalCase (`Customer`, `Order`, `PaymentType`)
- **Constants**: UPPER_SNAKE_CASE for config (`STORAGE_KEYS`, `API_ENDPOINTS`)
- **Files**: kebab-case for components, camelCase for utilities
- **Props Interfaces**: ComponentNameProps suffix (`OrderBuilderProps`)

### Error Handling
- **Try-Catch**: Always wrap async operations in try-catch
- **User Feedback**: Use ToastContext for user-friendly error messages
- **Error Boundaries**: Wrap critical sections with error boundaries
- **Logging**: Log errors appropriately (console.error for dev, sentry for prod)
```typescript
try {
  await db.orders.add(order);
} catch (error) {
  console.error('Failed to save order:', error);
  showToast('Failed to save order. Please try again.', 'error');
}
```

### Async Patterns
- **Always use async/await**: Never chain `.then()` or `.catch()`
- **Proper typing**: Always type async functions with return types
- **Loading states**: Show loading indicators during async operations
```typescript
const handleSave = async (): Promise<void> => {
  setIsLoading(true);
  try {
    await saveOrder(data);
    showToast('Order saved successfully', 'success');
  } catch (error) {
    showToast('Failed to save order', 'error');
  } finally {
    setIsLoading(false);
  }
};
```

### Database & API Patterns (Dexie.js)
- **Service Layer**: All DB operations in `services/db.ts`
- **Type Safety**: All tables and operations use TypeScript interfaces
- **Transactions**: Use transactions for multiple related updates
- **Offline First**: Design for offline-first with sync to Supabase

### Styling & UI
- **CSS Framework**: Tailwind CSS (utility-first approach)
- **Theming**: Dynamic theming via `ThemeContext` with CSS classes
- **Responsive**: Mobile-first design with touch-friendly interactions
- **Modals**: Use `Modal` component from `components/ui/Modal.tsx`
- **Loading States**: Skeleton components in `components/ui/skeletons/`

### Code Quality Rules
- **No `any`**: Avoid `any` type; use `unknown` or proper generics
- **Explicit Returns**: Always declare return types for functions
- **Early Returns**: Use early returns to reduce nesting
- **Destructuring**: Prefer destructuring for props and state
- **Constants**: Extract magic numbers to named constants

---

## Agent-Specific Guidelines

### When Making Changes
1. Run `npm run build` before committing to verify no build errors
2. Use TypeScript strict mode - avoid `any` types
3. Test on mobile viewport (375px width) as primary target

### When Adding New Features
1. Follow existing component patterns in `components/`
2. Add types to `types.ts` before implementing
3. Use Dexie.js for local storage, not localStorage directly

### When Fixing Bugs
1. Identify root cause, not just symptoms
2. Add error handling where missing
3. Test edge cases (empty data, network failure, etc.)
