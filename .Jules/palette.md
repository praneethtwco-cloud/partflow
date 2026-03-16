## 2024-05-19 - Added ARIA labels to icon-only buttons
**Learning:** Found several icon-only buttons (like modal close buttons, filter toggles, etc.) missing `aria-label` attributes across different components (`CustomerList.tsx`, `OrderHistory.tsx`). This is a common accessibility issue for screen reader users.
**Action:** Always ensure icon-only buttons have descriptive `aria-label` attributes to provide context for screen reader users.
