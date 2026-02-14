# Track Specification: CSV Import Enhancement

## Overview
Enhance the existing CSV import functionality to support all four data types (customers, inventory, orders, and orderLines) with proper column mapping and data validation. The system should handle existing records by updating them with new data from the CSV files.

## Functional Requirements

### 1. CSV Import Support for All Data Types
- [ ] Support importing customers data from "Spreparts - Customers.csv" with columns:
  - ID, Shop Name, Address, Phone, City, Discount 1, Discount 2, Balance, Credit Period, Status, Last Updated
- [ ] Support importing inventory data from "Spreparts - Inventory.csv" with columns:
  - ID, Display Name, Internal Name, SKU, Vehicle, Brand/Origin, Category, Unit Value, Stock Qty, Low Stock Threshold, Out of Stock, Status, Last Updated
- [ ] Support importing orders data from "Spreparts - Orders.csv" with columns:
  - Order ID, Customer ID, Rep ID, Date, Gross Total, Disc 1 Rate, Disc 1 Value, Disc 2 Rate, Disc 2 Value, Net Total, Paid, Balance Due, Payment Status, Delivery Status, Credit Period, Status, Last Updated
- [ ] Support importing orderLines data from "Spreparts - OrderLines.csv" with columns:
  - Line ID, Order ID, Item ID, Item Name, Qty, Unit Price, Line Total

### 2. Database Schema Alignment
- [ ] Ensure database schema has all required columns to match CSV formats
- [ ] Add any missing columns to existing tables if they don't exist
- [ ] Validate data types match between CSV and database fields

### 3. Data Update Logic
- [ ] Implement logic to detect existing records based on ID fields
- [ ] Update existing records with new data from CSV when IDs match
- [ ] Insert new records for IDs that don't exist in the database

### 4. Error Handling and Validation
- [ ] Validate CSV format and structure before processing
- [ ] Provide meaningful error messages for invalid data
- [ ] Log import results showing successful imports and any failures

### 5. Import Summary Reporting
- [ ] Display summary of imported records (total processed, updated, new, failed)
- [ ] Provide option to review and resolve any import conflicts

## Non-Functional Requirements
- [ ] Maintain data integrity during import operations
- [ ] Ensure import process is efficient for large CSV files
- [ ] Preserve audit trail of import operations
- [ ] Maintain offline capability for import operations

## Acceptance Criteria
- [ ] All four CSV file types can be successfully imported
- [ ] Existing records are updated correctly when IDs match
- [ ] New records are inserted when IDs don't exist
- [ ] Import process handles errors gracefully
- [ ] Import summary is displayed to the user
- [ ] Database schema supports all required columns from CSV files

## Out of Scope
- [ ] Export functionality (this is import-focused)
- [ ] Real-time synchronization during import
- [ ] Advanced data transformation beyond basic type conversion