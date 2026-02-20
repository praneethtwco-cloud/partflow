# PartFlow Pro - Agent Development Guide

**Project**: Enterprise Spare Parts Distribution Management System  
**Tech Stack**: React 19.2.4 + TypeScript 5.8.2 + Vite 6.2.0 + Capacitor 8.0.2 + Dexie.js 4.3.0 + PWA  
**Platform**: Web PWA + Android App + Desktop (Electron)  
**Deployment**: Vercel (Frontend) + Local API (Flask)

---

## Build, Lint & Test Commands

### Frontend (React + Vite)
```bash
npm run dev                # Start dev server (http://localhost:3000)
npm run build              # Build for production
npm run preview            # Preview production build locally
npm run sync               # Build and sync to Android (Capacitor)
npm run dev:electron       # Run Electron desktop app
npm run build:electron     # Build Electron app
npm run build:win          # Build Windows portable exe
npm run test:auth          # Run auth sync test script
```

### Testing (when configured with Vitest)
```bash
npm test                   # Run all tests
npm test -- --run SingleFile.test.ts    # Run single test file
npm test -- --watch      # Watch mode
npm test -- --coverage   # Coverage report
```

### Linting (when configured with ESLint)
```bash
npm run lint              # Run ESLint
npm run lint -- --fix     # Auto-fix issues
```

### Android Development
```bash
npm run sync              # Build and sync to Android
npx cap open android     # Open Android Studio
npx cap run android      # Run on device/emulator
```



---

## Code Style Guidelines

### TypeScript & React
- React 19.x with functional components and hooks
- TypeScript strict mode - avoid `any` type; use `unknown` or generics
- Functional components with explicit prop interfaces (ComponentNameProps)
- Path aliases: `@/*` configured in tsconfig.json

### Import Order
```typescript
// 1. React and React DOM
import React, { useState, useEffect, useCallback } from 'react';
// 2. Third-party libraries
import Dexie, { Table } from 'dexie';
// 3. Internal absolute imports (use @ alias)
import { Customer, Order } from '@/types';
// 4. Relative imports for same-module files
import { formatCurrency } from './currency';
```

### Component Structure
```typescript
interface ComponentNameProps {
  data: Item[];
  onAction: (id: string) => void;
  isLoading?: boolean;
}

export const ComponentName: React.FC<ComponentNameProps> = ({ data, onAction, isLoading }) => {
  // Hooks: custom → state → refs
  const { themeClasses } = useTheme();
  const [state, setState] = useState<Type>(initialValue);
  
  // Effects with cleanup
  useEffect(() => {
    return () => { /* cleanup */ };
  }, [dependencies]);
  
  // Event handlers (handleXxx naming)
  const handleClick = useCallback((id: string) => {
    onAction(id);
  }, [onAction]);
  
  // Early returns
  if (isLoading) return <Spinner />;
  
  // Render
  return <div className={themeClasses.container}>{/* ... */}</div>;
};
```

### Naming Conventions
- **Components**: PascalCase (`OrderBuilder`, `CustomerList`)
- **Hooks**: camelCase with `use` prefix (`useAuth`, `useTheme`)
- **Variables**: camelCase (`outstandingBalance`, `syncStatus`)
- **Types**: PascalCase (`Customer`, `Order`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEYS`)
- **Files**: kebab-case (components), camelCase (utilities)

### Error Handling
- Always wrap async operations in try-catch
- Use ToastContext for user feedback
- Log errors with console.error
```typescript
try {
  await db.orders.add(order);
} catch (error) {
  console.error('Failed to save order:', error);
  showToast('Failed to save order. Please try again.', 'error');
}
```

### Async Patterns
- Use async/await - never chain `.then()` or `.catch()`
- Always declare return types
- Show loading indicators during async operations
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

### Database (Dexie.js)
- All DB operations in `services/db.ts`
- Use transactions for multiple related updates
- Design for offline-first with Supabase sync

### Styling
- Tailwind CSS (utility-first)
- Mobile-first design (375px primary viewport)
- Dynamic theming via ThemeContext

---

## Agent-Specific Guidelines

### Before Committing
1. Run `npm run build` to verify no build errors
2. Test on mobile viewport (375px width)

### Adding New Features
1. Follow existing component patterns in `components/`
2. Add types to `types.ts` before implementing
3. Use Dexie.js for local storage, never localStorage

### Fixing Bugs
1. Identify root cause, not symptoms
2. Add error handling where missing
3. Test edge cases (empty data, network failure)
