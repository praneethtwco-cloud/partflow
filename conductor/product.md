# Product Definition

## Project Overview
Akila Node is a comprehensive inventory management system designed to streamline stock tracking, order processing, and business operations for retail businesses. The system now includes advanced reporting capabilities to provide business intelligence insights. The application has been restructured to be fully cloud-based with Supabase integration, featuring automated synchronization and CSV import capabilities.

## Vision
To provide an intuitive, efficient inventory management solution that helps businesses maintain optimal stock levels, reduce waste, and improve customer satisfaction.

## Goals
- Enable real-time inventory tracking
- Facilitate efficient order processing
- Provide analytics and reporting capabilities
- Streamline procurement and supplier management
- Support multi-location inventory management
- Deliver actionable business insights through comprehensive sales reporting
- Implement configurable invoice numbering system with customizable prefixes and sequential numbering
- Allow editing of synced invoices with proper tracking and conflict resolution in Supabase
- Implement sequential invoice numbering system with configurable prefix and starting number
- Enable editing of synced invoices with proper record replacement in Supabase using unique identifiers
- Use invoice number as the primary identifier replacing order ID for better consistency
- Allow editing of existing invoices without creating new records, preserving order ID while updating invoice number
- Preserve draft and non-approved invoices during sync operations to prevent data loss
- Ensure proper invoice number display throughout the application instead of order IDs
- Maintain draft orders in local storage during incremental sync with Supabase
- Correct variable scoping issues in sync logic to prevent runtime errors
- Implement fully automated cloud synchronization with Supabase
- Remove manual sync mechanisms in favor of automatic online/offline sync
- Provide CSV import functionality for bulk data migration
- Implement offline queue system for pending changes when disconnected
- Handle sync conflicts using last-write-wins approach