# Delivery Management Enhancement Specification

## Overview

Enhance the Order History page with comprehensive delivery management capabilities, allowing users to efficiently manage delivery workflows for individual orders and batch operations.

**Current State Analysis:**
- ✅ Batch selection with checkboxes already implemented
- ✅ Quick delivery action buttons (Ship, Out, Done) exist on each order card
- ✅ Delivery modal with date picker exists
- ✅ `delivery_date` field exists in Order type and database
- ✅ `updateDeliveryStatus` method supports optional `deliveryDate` parameter

**Issues to Fix:**
1. ❌ Batch actions don't support custom date selection (always uses current time)
2. ❌ No confirmation when quickly changing delivery status from order card
3. ❌ Delivery date field in modal doesn't default to current date/time
4. ❌ No visual indicator showing when delivery date was last updated
5. ❌ Batch action bar doesn't include "Failed" or "Cancelled" status options
6. ❌ No delivery notes support in batch operations

## Functional Requirements

### FR1: Individual Order Delivery Management
- **FR1.1**: Users can update delivery status for individual orders via:
  - Quick action buttons (Ship, Out, Done) on order cards
  - Full delivery modal with all status options and date picker
- **FR1.2**: Delivery date should default to current date/time but be editable
- **FR1.3**: Delivery date is automatically timestamped when status changes
- **FR1.4**: Delivery status badge displays current status with color coding

### FR2: Batch Delivery Management
- **FR2.1**: Users can select multiple orders using checkboxes
- **FR2.2**: "Select All" checkbox selects/deselects all visible orders
- **FR2.3**: Batch action bar appears when orders are selected
- **FR2.4**: Batch actions support all delivery statuses:
  - Shipped
  - Out for Delivery
  - Delivered
  - Failed
  - Cancelled
- **FR2.5**: Batch operations update all selected orders with current timestamp
- **FR2.6**: Batch operations show confirmation before executing

### FR3: Delivery Date Handling
- **FR3.1**: Delivery date defaults to current date/time when modal opens
- **FR3.2**: Users can manually set delivery date/time via datetime picker
- **FR3.3**: If date left empty, system uses current timestamp
- **FR3.4**: Delivery date displays on order cards when present
- **FR3.5**: Delivery date stored in ISO 8601 format

### FR4: Delivery Status Transitions
- **FR4.1**: Support all delivery status values:
  - `pending` (default)
  - `shipped` (order dispatched from warehouse)
  - `out_for_delivery` (on vehicle for delivery)
  - `delivered` (successfully delivered)
  - `failed` (delivery attempt failed)
  - `cancelled` (order cancelled)
- **FR4.2**: Status changes trigger automatic stock management:
  - Failed/Cancelled orders restore stock
  - Moving from Failed/Cancelled back to active re-deducts stock
- **FR4.3**: Status changes update customer outstanding balance:
  - Failed/Cancelled orders excluded from balance calculation

### FR5: User Experience
- **FR5.1**: Color-coded status badges for quick visual identification
- **FR5.2**: Confirmation dialogs for destructive actions (Failed, Cancelled)
- **FR5.3**: Toast notifications for successful status updates
- **FR5.4**: Order list refreshes after status changes
- **FR5.5**: Smooth animations for batch action bar appearance

## Non-Functional Requirements

### NFR1: Performance
- **NFR1.1**: Batch operations on up to 100 orders complete within 5 seconds
- **NFR1.2**: Order history list maintains smooth scrolling with 1000+ orders

### NFR2: Data Integrity
- **NFR2.1**: All delivery status changes logged with timestamp
- **NFR2.2**: Stock adjustments are atomic (all or nothing)
- **NFR2.3**: Customer balance recalculations are accurate

### NFR3: Usability
- **NFR3.1**: Mobile-responsive design for all delivery controls
- **NFR3.2**: Touch-friendly controls (minimum 44x44px)
- **NFR3.3**: Clear visual feedback for selected orders

### NFR4: Sync Compatibility
- **NFR4.1**: Delivery status changes marked as `sync_status: 'pending'`
- **NFR4.2**: Changes sync to Supabase on next auto-sync cycle

## Acceptance Criteria

### AC1: Individual Order Update
- [ ] Clicking quick action button updates status immediately
- [ ] Delivery date defaults to current timestamp
- [ ] Order card refreshes to show new status badge
- [ ] Stock adjusts correctly for status change
- [ ] Customer balance recalculates

### AC2: Batch Selection
- [ ] Checkboxes appear on all order cards
- [ ] "Select All" toggles selection for all filtered orders
- [ ] Selected orders show visual highlight (border + ring)
- [ ] Batch action bar appears when orders selected
- [ ] Selection count displays in action bar

### AC3: Batch Delivery Update
- [ ] All status options available in batch actions (Shipped, Out, Delivered, Failed, Cancelled)
- [ ] Confirmation dialog appears before batch update
- [ ] All selected orders updated with same status
- [ ] All orders receive current timestamp
- [ ] Order list refreshes after update
- [ ] Batch selection clears after update

### AC4: Delivery Modal
- [ ] Modal opens when clicking delivery icon
- [ ] Current status shown as selected
- [ ] Date picker defaults to current date/time
- [ ] All 6 status options available as buttons
- [ ] Clicking status button updates order
- [ ] Modal closes after update
- [ ] Date picker value used if provided, otherwise current time

### AC5: Visual Design
- [ ] Status badges use correct colors:
  - Pending: Amber
  - Shipped: Blue
  - Out for Delivery: Indigo
  - Delivered: Emerald
  - Failed: Rose
  - Cancelled: Slate
- [ ] Batch action bar fixed at bottom with proper z-index
- [ ] Animations smooth (slide-in for batch bar)
- [ ] Mobile layout optimized

### AC6: Edge Cases
- [ ] Cannot select orders when none exist
- [ ] Batch actions disabled when no orders selected
- [ ] Date picker handles timezone correctly
- [ ] Stock doesn't double-adjust on repeated status changes
- [ ] Failed/Cancelled orders correctly excluded from customer balance

## Out of Scope

1. **Delivery Route Optimization**: Automatic route planning for deliveries
2. **Driver Assignment**: Assigning orders to specific delivery drivers
3. **GPS Tracking**: Real-time delivery vehicle tracking
4. **Customer Notifications**: SMS/email notifications for delivery status
5. **Proof of Delivery**: Photo capture, digital signatures
6. **Delivery Time Windows**: Scheduled delivery time slots
7. **Multi-stop Delivery Planning**: Optimizing delivery sequences
8. **Delivery Analytics**: Reports on delivery performance metrics
9. **Barcode Scanning for Delivery**: Scan-to-confirm delivery
10. **Integration with External Logistics**: Third-party delivery services

## Technical Constraints

1. **Database**: Must use existing Dexie.js IndexedDB structure
2. **TypeScript**: All code must be strictly typed
3. **React**: Functional components with hooks only
4. **Sync**: Changes must be compatible with Supabase sync
5. **Mobile**: Must work on Android via Capacitor
6. **Offline**: Must function without internet connectivity

## Success Metrics

1. **Task Completion Time**: Reduce time to mark 10 orders as delivered from 60s to 30s
2. **User Satisfaction**: No user complaints about delivery management
3. **Data Accuracy**: 100% accurate delivery timestamps
4. **Stock Accuracy**: 100% accurate stock adjustments for failed/cancelled orders
