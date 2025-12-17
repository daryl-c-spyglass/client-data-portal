# MLS Grid IDX/CMA Platform

## Overview

This project is a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing (similar to Zillow or Redfin) with robust, productivity-focused workflow features to streamline real estate operations.

## Recent Changes (Dec 17, 2025)

- **Repliers Sold Data Integration FIXED**: All listing statuses now working via Repliers API
  - **Root Cause**: Was using wrong parameter `status='S'` - Repliers uses RESO-compliant `standardStatus`
  - **Solution**: Updated all code to use `standardStatus=Active/Pending/Closed` (RESO-compliant)
  - Active listings: `standardStatus=Active`
  - Under Contract/Pending: `standardStatus=Pending`
  - Sold/Closed: `standardStatus=Closed`
  - All statuses now working with photos from Repliers (3 months historical for sold)
- **Repliers API Diagnostic Endpoint**: `/api/repliers/test` verifies connection and capabilities
  - Tests Active, Pending/Under Contract, and Closed status support
  - All three statuses now show as enabled
- **Settings Page Data Source Status**: Shows capability status for each data source
  - Active: ✓, Under Contract: ✓, Sold: ✓ for Repliers
- **Data Source Architecture**: 
  - **Repliers API**: Primary source for ALL statuses (Active, Pending, Closed)
  - **Database Fallback**: Only used if Repliers API fails
  - Uses RESO-compliant `standardStatus` parameter (not legacy `status`)
- **Dashboard Sold Price Fix**: Dashboard sold/closed property cards now correctly display closePrice instead of listPrice
  - PropertyDetailModal: Uses closePrice for sold/closed properties, listPrice for active listings
  - Recent Sales Activity: Uses displaySoldPrice(closePrice) helper for sold properties
  - Fixed "Price upon request" display when sold price was available
- **Properties Page Autocomplete**: Fixed AutocompleteInput component to properly handle API response formats
  - Now handles both `{ suggestions: [...] }` format and direct array responses
  - Converts string suggestions to AutocompleteOption format for consistent display
- **Seller Update Preview Page**: Added new preview page for seller updates
  - New route: `/seller-updates/:id/preview`
  - Displays update details, matching properties, and market stats
  - Shows sample properties with photos and pricing
- **Neighborhood Display Improvements**: Property Detail page now shows clear fallback states
  - "Loading..." while fetching boundary resolution
  - "Not available" when neighborhood couldn't be resolved from boundaries
  - "Coordinates required" when property lacks lat/lng data
- **TypeScript Fixes**: Fixed LSP errors in server/routes.ts
  - Used type assertions for Repliers API response properties not in TypeScript definitions
  - Resolved subdivisionName/subdivision property access errors

## Recent Changes (Dec 15, 2025)

- **CRITICAL DATA MAPPING FIX**: Fixed fundamental data integrity issue where Repliers API "neighborhood" field was incorrectly displayed as neighborhood
  - Repliers "neighborhood" field now correctly maps to `subdivision` (tract/community label from listing)
  - `neighborhood` field now only populated via boundary polygon resolution using lat/lng coordinates
  - PropertyDetail uses `/api/neighborhoods/by-coordinates` endpoint for geographic boundary resolution
  - NeighborhoodReview component only renders when neighborhood is resolved from boundary (not from listing data)
  - **Data Integrity Rule**: Subdivision = MLS listing field, Neighborhood = boundary polygon resolution only
- **Enhanced Location Debug Panel (DEV mode)**: Property Detail page now includes comprehensive debug panel showing:
  - Data Source (Repliers API vs PostgreSQL) with fetch timestamp
  - Raw Subdivision Fields showing all candidate API fields (address.neighborhood, details.subdivision, etc.)
  - Subdivision Source indicating which field was selected (e.g., "address.neighborhood")
  - Final Value showing the resolved subdivision string
  - Data integrity rules documentation in the panel
  - Separate DEV-mode query always fetches fresh `_debug` payload from API regardless of cache
- **Location Display Consistency**: Removed incorrect neighborhood displays from:
  - Dashboard property floating cards (now shows Subdivision only)
  - PropertyMapView info windows (now shows Subdivision only)
  - CMAReport floating cards (now shows Subdivision only)
  - Updated DashboardProperty TypeScript interface to include subdivision field
- **Neighborhood Filter in CMA & Buyer Search**: Added separate Neighborhood filter (geographic boundary area) distinct from Subdivision (tract/community label)
  - CMABuilder: New Neighborhood autocomplete field with persistence in search criteria
  - BuyerSearch: New Neighborhoods filter with OR/Not modes and autocomplete
  - Both use `/api/autocomplete/neighborhoods` endpoint backed by Repliers locations cache
- **Neighborhood Review Feature**: Added neighborhood-level market stats with boundary polygon maps on Property Detail page
  - New `NeighborhoodReview` component shows Active/Under Contract/Sold counts, avg prices, avg DOM, price/sqft
  - Polygon boundary overlay from Repliers Locations API with property markers
  - Boundary caching in PostgreSQL with 24-hour TTL
  - API endpoints: `/api/neighborhoods/review` and `/api/neighborhoods/by-coordinates`
  - Clear distinction: **Neighborhood** = geographic boundary area (market overview) vs **Subdivision** = tract/community label (CMA comps)
- **Data Synchronization Fix**: Inventory status counts (Active/Under Contract) now filter by `class: 'residential'` to match subtype aggregation
- **Property Detail Back Navigation**: Property detail page tracks origin path via `?from=` query param and shows contextual back button labels (e.g., "Back to Dashboard", "Back to CMA")
- **Buyer Search Autocomplete Fixed**: API endpoints now consistently return `{ suggestions: [...] }` format, enabling dropdown display
- **Dashboard Quick Actions**: Replaced "Sync Data" button with "Settings" link for cleaner UX
- **CMA Property Types**: Updated PROPERTY_TYPES to include separate entries for Ranch, Manufactured Home, Unimproved Land, Multiple Lots
- **Properties Page Inventory Consistency**: Total Properties count now strictly matches the sum of Property Inventory by Type (subtype breakdown is authoritative)
- **Dev-Only Debug Logging**: Added development-mode logging for inventory count reconciliation and CMA property cross-checking (address, prices, living area, $/sqft) for PDF verification
- **Settings Page Overhaul**: New comprehensive Settings page (`/settings`) with 5 organized tabs:
  - Profile: Agent and brokerage information
  - Data & Sync: MLS Grid sync status and controls
  - Display: Price format, area units, date format preferences
  - Embed Code: Widget embed code generator (moved from nav)
  - Lead Gate: Lead capture configuration (moved from admin nav)
- **Navigation Cleanup**: Removed Embed Code and Admin section from sidebar, consolidated into Settings
- **Coming Soon Pages**: Added Clients (`/clients`) and Analytics (`/analytics`) placeholder pages with feature previews
- **Dashboard Improvements**:
  - Enhanced sold property floating cards with Sold Price, Year Built, Beds/Baths/SqFt
  - Added "No photos available" placeholder for missing property images
  - Added Recent CMAs sorting (Newest/Oldest, A-Z, Z-A)
  - Shared `displaySoldPrice()` helper for consistent price formatting
- **Buyer Search Autocomplete**: Cities, Zip Codes, Subdivision, and Elementary School fields now have autocomplete
- **Properties Page**: Restored full date range picker with Month/Day/Year From+To
- **CMA Print Styling**: Clean report style excluding agent UI with proper margins and page breaks

## Recent Changes (Dec 12, 2025)

- **CMA Map Marker Consistency**: Unified map marker styling between Listings and Market Stats tabs using shared `getCompIcon` function with case-insensitive status detection. Handles all status variants: "Under Contract", "Pending", "Active Under Contract - Showing", "Contingent", etc.
- **YoY Timeline Metrics**: Added Year-over-Year price comparison to Timeline Market Insights showing average and median sold price changes (last 12 months vs prior 12 months)
- **Print/PDF Improvements**: Enhanced print CSS to hide yellow preview/action banner, fix PDF content cut-off with proper overflow handling, page breaks, white backgrounds, and scrollbar artifact removal
- **CMA Report UI Refinements**:
  - Renamed "Listings & Map" tab to "Listings" in CMA results
  - Synced listing filter pills (All/Sold/Active/Under Contract) with Property Location map markers
  - Restructured Listings tab: stats cards + property list (left) | map (right, sticky) | Price Distribution (full width below)
- **Property Type Formatter**: Added centralized `formatPropertyType()` utility in `client/src/lib/property-type-utils.ts` for consistent property type display across all components
- **Expanded Property Types**: Support for 9 property type categories: Single Family, Condo, Townhouse, Multi-Family, Manufactured Home, Ranch, Land, Multiple Lots, Commercial

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite for development and bundling. It utilizes `shadcn/ui` (New York style variant) based on Radix UI for its component system, prioritizing visual appeal for client engagement and functional efficiency for agents. Styling is managed with Tailwind CSS, incorporating custom design tokens for consistency and supporting light/dark modes. State management is handled by TanStack Query with aggressive caching, and Wouter provides lightweight client-side routing. Key pages include Dashboard, Property Search, Property Detail, CMA management, and CMA report generation. The UI incorporates Spyglass Realty branding with an orange primary color scheme.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript, using an ESM module system. It exposes a RESTful API with type-safe request/response handling for properties, CMAs, and system health checks. A flexible storage interface (`IStorage`) supports in-memory, database (PostgreSQL via Drizzle ORM), and hybrid storage solutions. The system includes a built-in rate limiter to comply with MLS Grid API usage policies, automatically queuing and delaying requests to maintain limits (2 req/sec, 7200 req/hour). A scheduled daily sync ensures the property database is updated, with a manual trigger available. The API intelligently routes property searches: active/under_contract listings query the Repliers API, while closed/sold listings query the local PostgreSQL database. Server-side filtering is applied for specific property subtypes and address components when Repliers API limitations require it.

### Database Schema

The platform uses Drizzle ORM with PostgreSQL, adhering to type-safe schema definitions. Core tables include `properties` (RESO Data Dictionary compliant data), `media` (for property images), `saved_searches`, and `cmas`. Zod schemas are used for runtime validation, generated from Drizzle schemas. The design philosophy strictly follows the MLS Grid's RESO Data Dictionary standard while accommodating MLS-specific fields. Property search performance is optimized with database-level pagination and trigram indexes.

## External Dependencies

- **MLS Grid API**: The primary data source for property listings, providing data from various MLS systems. It handles authentication, automated data synchronization, and RESO Data Dictionary standardization.
- **Repliers API**: Primary data source for active and under contract property listings, offering real-time updates and geo-coordinates.
- **PostgreSQL**: Used for persistent data storage in production environments, leveraging the Neon serverless driver. Stores historical sold data and other application-specific information.
- **Amazon S3**: Utilized for storing media assets, such as property images and documents.
- **`connect-pg-simple`**: Provides PostgreSQL-backed session management.
- **Google Fonts CDN**: Used for typography, specifically the Inter font family.
- **Recharts**: Integrated for charting and data visualization within CMA reports and the dashboard.
- **SendGrid**: Used for email services, such as sending seller updates.