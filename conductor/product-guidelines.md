# Product Guidelines

## Design Principles

### 1. Offline-First Mindset
- **Always Available**: App must function without internet connectivity
- **Local First**: All operations work on local database initially
- **Sync Transparent**: Cloud sync happens in background without user intervention
- **Graceful Degradation**: Clear indicators when offline, no functionality loss

### 2. Mobile-First Design
- **Touch-Optimized**: All interactive elements sized for touch (min 44x44px)
- **Thumb-Friendly**: Primary actions in easy-to-reach areas
- **Responsive**: Adapts to all screen sizes (phone, tablet, desktop)
- **Performance**: Fast load times, smooth animations, minimal battery drain

### 3. POS-Style Efficiency
- **Speed Critical**: Optimize for rapid order creation (< 60 seconds)
- **Minimal Taps**: Reduce clicks/taps for common actions
- **Keyboard Shortcuts**: Support power users with keyboard navigation
- **Search First**: Fast, fuzzy search for items and customers

### 4. Professional Aesthetics
- **Clean & Modern**: Professional business application appearance
- **Consistent Branding**: Company logo and colors on invoices
- **High Contrast**: Readable in various lighting conditions
- **Polished Details**: Attention to spacing, typography, and visual hierarchy

## User Experience Guidelines

### Navigation Patterns

#### Mobile Navigation
- **Bottom Tab Bar**: Primary navigation (5-7 tabs max)
- **Active State**: Clear visual indication of current tab
- **Back Button**: Hardware back button support on Android
- **Gesture Support**: Pull-to-refresh, swipe to go back

#### Desktop Navigation
- **Top Navigation Bar**: Full menu with all sections
- **Keyboard Navigation**: Tab through interactive elements
- **Breadcrumbs**: Show location in app hierarchy
- **Quick Actions**: Keyboard shortcuts for common tasks

### Data Entry Optimization

#### Form Design
- **Smart Defaults**: Pre-fill fields with likely values
- **Input Masks**: Format phone numbers, dates automatically
- **Auto-Complete**: Suggest values based on history
- **Validation**: Real-time validation with clear error messages
- **Progressive Disclosure**: Show advanced fields only when needed

#### Search & Selection
- **Fuzzy Search**: Tolerant of typos and partial matches
- **Recent Items**: Quick access to frequently used items
- **Barcode Scanning**: Camera-based barcode/QR scanning
- **Filter Options**: Narrow results by category, brand, etc.
- **Keyboard Navigation**: Arrow keys to navigate results

### Feedback & Communication

#### Toast Notifications
- **Success**: Green, auto-dismiss after 3 seconds
- **Error**: Red/Rose, auto-dismiss after 5 seconds
- **Warning**: Amber, auto-dismiss after 4 seconds
- **Info**: Blue/Indigo, auto-dismiss after 3 seconds

#### Loading States
- **Skeleton Screens**: Show content structure while loading
- **Progress Indicators**: For operations > 2 seconds
- **Optimistic UI**: Update immediately, sync in background
- **Pull-to-Refresh**: Visual feedback during refresh

#### Error States
- **User-Friendly Messages**: Avoid technical jargon
- **Actionable Guidance**: Tell user what to do next
- **Retry Options**: Allow retry for recoverable errors
- **Graceful Degradation**: App remains usable despite errors

## Visual Design System

### Color Palette

#### Primary Colors (Themeable)
```
Indigo (Default):
- Primary: #4F46E5 (indigo-600)
- Primary Light: #EEF2FF (indigo-50)
- Primary Dark: #312E81 (indigo-900)
```

#### Semantic Colors
```
Success: #10B981 (emerald-500)
Warning: #F59E0B (amber-500)
Error: #EF4444 (rose-500)
Info: #6366F1 (indigo-500)
```

#### Neutral Colors
```
Background: #F8FAFC (slate-50)
Surface: #FFFFFF (white)
Border: #E2E8F0 (slate-200)
Text Primary: #0F172A (slate-900)
Text Secondary: #64748B (slate-500)
```

### Typography

#### Font Family
- **Primary**: System font stack (San Francisco, Inter, Segoe UI)
- **Monospace**: For SKU codes, numbers (JetBrains Mono, Fira Code)

#### Font Sizes
```
xs: 0.75rem (12px) - Labels, captions
sm: 0.875rem (14px) - Secondary text
base: 1rem (16px) - Body text
lg: 1.125rem (18px) - Subheadings
xl: 1.25rem (20px) - Section titles
2xl: 1.5rem (24px) - Page titles
```

#### Font Weights
```
Normal: 400 - Body text
Medium: 500 - Buttons, labels
Semibold: 600 - Headings
Bold: 700 - Emphasis, badges
```

### Spacing & Layout

#### Spacing Scale
```
1: 0.25rem (4px)
2: 0.5rem (8px)
3: 0.75rem (12px)
4: 1rem (16px)
6: 1.5rem (24px)
8: 2rem (32px)
12: 3rem (48px)
16: 4rem (64px)
```

#### Layout Principles
- **Consistent Padding**: Use spacing scale consistently
- **Visual Grouping**: Related items close together
- **White Space**: Generous spacing for readability
- **Alignment**: Consistent alignment (left, center, right)

### Component Design

#### Cards
- **Background**: White with subtle shadow
- **Border Radius**: Rounded-xl (12px)
- **Padding**: p4 (16px) minimum
- **Shadow**: shadow-sm for cards, shadow-md for modals

#### Buttons
- **Primary**: Filled with brand color, white text
- **Secondary**: Outlined with brand color
- **Tertiary**: Text-only, no border
- **Sizes**: sm (py1.5, px3), md (py2, px4), lg (py3, px6)
- **States**: Hover, active, disabled, loading

#### Input Fields
- **Border**: 1px solid slate-200
- **Focus**: Brand color border with ring
- **Error**: Rose border with error message
- **Disabled**: Slate-100 background, not-allowed cursor

#### Badges
- **Success**: Emerald background, emerald text
- **Warning**: Amber background, amber text
- **Error**: Rose background, rose text
- **Info**: Indigo background, indigo text

## Accessibility Guidelines

### WCAG 2.1 Compliance (Target: AA)

#### Color Contrast
- **Normal Text**: 4.5:1 minimum contrast ratio
- **Large Text**: 3:1 minimum contrast ratio
- **UI Components**: 3:1 minimum contrast ratio

#### Keyboard Navigation
- **Focus Visible**: Clear focus indicators
- **Tab Order**: Logical tab sequence
- **Skip Links**: Skip to main content
- **Keyboard Shortcuts**: Document all shortcuts

#### Screen Reader Support
- **Alt Text**: Descriptive alt text for images
- **ARIA Labels**: Labels for interactive elements
- **Semantic HTML**: Proper heading hierarchy
- **Live Regions**: Announce dynamic content changes

### Mobile Accessibility
- **Touch Target Size**: Minimum 44x44 pixels
- **Text Scaling**: Support dynamic text sizing
- **Reduce Motion**: Respect reduced motion preference
- **VoiceOver/TalkBack**: Test with screen readers

## Performance Guidelines

### Load Time Targets
- **Initial Load**: < 3 seconds on 3G
- **Time to Interactive**: < 5 seconds
- **Route Change**: < 300ms
- **Search Results**: < 200ms

### Optimization Techniques
- **Code Splitting**: Load routes on demand
- **Lazy Loading**: Defer non-critical resources
- **Image Optimization**: Compress and lazy load images
- **Caching**: Cache API responses and static assets
- **Debouncing**: Debounce search input

### Bundle Size Budget
- **Initial Bundle**: < 500KB (gzipped)
- **Total Bundle**: < 2MB (gzipped)
- **Critical CSS**: < 50KB

## Responsive Design

### Breakpoints
```
sm: 640px (Mobile landscape)
md: 768px (Tablet portrait)
lg: 1024px (Tablet landscape)
xl: 1280px (Desktop)
2xl: 1536px (Large desktop)
```

### Responsive Patterns
- **Mobile First**: Design for mobile, enhance for desktop
- **Progressive Disclosure**: Show essential info on mobile
- **Adaptive Layouts**: Different layouts per breakpoint
- **Touch vs Mouse**: Different interaction patterns

## Invoice Design

### Professional Invoice Requirements
- **Company Branding**: Logo, name, address prominently displayed
- **Clear Typography**: Readable fonts, proper hierarchy
- **Itemized List**: Clear breakdown of items, quantities, prices
- **Totals Section**: Subtotal, discounts, tax, grand total clearly shown
- **Payment Terms**: Payment due date, methods accepted
- **Professional Footer**: Thank you message, contact info

### PDF Generation Standards
- **Page Size**: A4 or Letter standard
- **Margins**: Adequate margins for printing
- **Resolution**: High resolution for professional printing
- **File Size**: Optimized for email (< 1MB if possible)

## Error Prevention & Recovery

### Data Loss Prevention
- **Auto-Save**: Draft orders saved automatically
- **Confirmation Dialogs**: Confirm destructive actions
- **Undo Support**: Allow undo for recent actions
- **Backup**: Automatic CSV backup before sync

### Error Recovery
- **Retry Logic**: Automatic retry for transient failures
- **Offline Queue**: Queue operations when offline
- **Conflict Resolution**: Clear UI for resolving conflicts
- **Data Export**: Easy export for manual backup

## Testing Guidelines

### Visual Testing
- **Cross-Browser**: Test on Chrome, Firefox, Safari, Edge
- **Cross-Device**: Test on various screen sizes
- **Dark Mode**: Test dark theme if supported
- **Print**: Test invoice printing

### User Testing
- **Usability Testing**: Observe real users completing tasks
- **A/B Testing**: Test alternative designs for key flows
- **Accessibility Testing**: Test with assistive technologies
- **Performance Testing**: Test on low-end devices

## Documentation Standards

### Component Documentation
```markdown
## Component Name

### Purpose
What the component does and when to use it.

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|

### Usage
```tsx
<Component prop="value" />
```

### Examples
Show common use cases.
```
```

### Code Style
- **Naming**: Descriptive component and variable names
- **Comments**: Comment complex logic, not obvious code
- **Formatting**: Consistent indentation and spacing
- **Types**: Explicit type annotations for public APIs

## Brand Guidelines

### Logo Usage
- **Minimum Size**: 32px height for digital
- **Clear Space**: Minimum 1x logo height around logo
- **Background**: Use on contrasting backgrounds only
- **Variations**: Full color, monochrome, reversed versions

### Voice & Tone
- **Professional**: Business-appropriate language
- **Friendly**: Approachable, not robotic
- **Concise**: Clear and to the point
- **Helpful**: Guide users to success

### Messaging
- **Success**: "Order created successfully!"
- **Error**: "Failed to save order. Please check your connection and try again."
- **Warning**: "You have unsaved changes. Are you sure you want to leave?"
- **Info**: "Syncing your data to the cloud..."
