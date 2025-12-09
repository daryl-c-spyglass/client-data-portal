# MLS Grid IDX/CMA Platform

## Overview

This project is a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing (similar to Zillow or Redfin) with robust, productivity-focused workflow features to streamline real estate operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

### Property SubType & Address Server-Side Filtering (Dec 9, 2025)
- **Issue**: Repliers API doesn't support `propertySubType` or `streetName`/`streetNumber` filters directly - both Single Family homes and Land properties fall under "residential" class
- **Solution**: Added server-side filtering in `/api/repliers/listings` endpoint:
  - **propertySubType filter**: When "Single Family" is selected, excludes properties containing "land", "lot", "unimproved", "vacant" in their subtype
  - **streetName filter**: Geocodes address via Mapbox, creates lat/lng bounding box (~1km), then post-filters for exact street match
  - **streetNumber filter**: Supports min/max street number range filtering
- **Performance**: Fetches 4x results when filtering is needed to ensure enough matches after filtering
- **Tested**: Filtering for "Single Family" now correctly returns only "Single Family Residence" (no Land properties)

### Unified Search API with Repliers Primary (Dec 9, 2025)
- **Repliers as Primary Data Source**: Repliers API is the preferred data source for property search
- **Unified Search Endpoint**: Created GET /api/search that intelligently routes based on status:
  - `status=active` or `status=under_contract` → queries Repliers API (30,000+ listings)
  - `status=closed` or `status=sold` → queries local PostgreSQL database (65,649 properties)
- **Repliers API Limitation**: Repliers only supports status 'A' (Active) and 'U' (Under Contract). It does NOT support status 'S' (Sold) - returns 400 error. Therefore closed/sold must come from local database.
- **Numeric Type Preservation**: All numeric fields (listPrice, closePrice, livingArea, yearBuilt, latitude, longitude, daysOnMarket, lotSizeSquareFeet, garageSpaces) are properly typed as numbers, not strings
- **Complete Analytics Fields**: Extended normalization includes cumulativeDaysOnMarket, lotSizeSquareFeet, lotSizeAcres, garageSpaces, closeDate
- **Status Normalization**: Consistent MLS-standard status values across all data sources:
  - Repliers 'A' → 'Active'
  - Repliers 'U' → 'Active Under Contract'
  - Database 'Closed' → 'Closed'
- **Data Mapper**: Added `mapNormalizedToProperty()` in client/src/lib/api.ts for converting normalized API response to Property type
- **CMA Compatibility**: Normalized data ensures CMA statistics calculations work correctly with both active (Repliers) and closed (database) listings
- **Test Address**: 3616 Sand Dunes Ave, Austin, TX 78744 (status: Active, from Repliers)

### MLS Grid Scheduled Sync (Dec 9, 2025)
- **Automatic Daily Sync**: Enabled scheduled MLS Grid sync to run automatically at 12:00 AM CST daily
- **Fresh Data**: Ensures property database is updated with the latest listings before business hours
- **Manual Trigger**: Added `/api/sync` POST endpoint (requires auth) to trigger manual sync when needed
- **Sync Status**: Added `/api/sync/status` GET endpoint to check scheduled sync information
- **Rate Limit Compliance**: Sync respects MLS Grid rate limits (2 req/sec, 7200 req/hour)
- **Background Processing**: Sync runs in background without blocking API requests
- **Implementation**: Uses `America/Chicago` timezone for accurate CST scheduling

### Spyglass Realty Branding (Dec 8, 2025)
- **Brand Colors**: Updated to Spyglass Realty color scheme with orange primary (HSL 25, 90%, 52%) and clean black/white design
- **Logo**: Added Spyglass Realty logo to sidebar header (attached_assets/Large_Logo_1765233192587.jpeg)
- **Dashboard**: Updated welcome text to reference "Spyglass Realty agent platform"
- **Design Guidelines**: Updated design_guidelines.md with Spyglass brand identity and color specifications
- **Dark Mode**: Maintained orange accent colors for dark mode compatibility

### Repliers API Integration (Dec 8, 2025)
- **New Primary Data Source**: Integrated Repliers API as the primary data source for property search, replacing HomeReview.
- **Benefits**: Repliers includes latitude/longitude coordinates with every property - no geocoding required for map view.
- **API Client**: Created `server/repliers-client.ts` with support for listings search, single listing lookup, locations, and AI-powered NLP search.
- **Endpoints Added**: `/api/repliers/listings`, `/api/repliers/listings/:mlsNumber`, `/api/repliers/locations`, `/api/repliers/nlp`
- **Parameter Mapping**: Repliers uses specific parameter names: `zip` (not postalCode), `class` (for Residential/Commercial/Condo), `status` (A/U/S for Active/Under Contract/Sold)
- **Data Volume**: 30,000+ active listings available with real-time updates.
- **Sort Options**: Uses Repliers-specific sort values like `listPriceDesc`, `listPriceAsc`, `createdOnDesc`, etc.
- **Environment Variable**: `REPLIERS_API_KEY` required for API access.

### Clickable Property Cards & Real Data Detail Page (Dec 6, 2025)
- **Navigation**: Property cards in Buyer Search are now clickable and navigate to the property detail page.
- **Data Passing**: Property data is passed via React context (SelectedPropertyContext) instead of re-fetching from API, since HomeReview API doesn't support single-property lookups.
- **Route**: Clicking a property card navigates to `/properties/:listingId` which displays the full property details.
- **State Preservation**: Search state (results, filters, trigger) is saved to context before navigation, ensuring "Back to Search" restores results.
- **Back Navigation**: Property detail page includes "Back to Search" button that returns to the buyer search with results fully preserved.

### Buyer Search Server-Side Filtering Fix (Dec 6, 2025)
- **Issue**: HomeReview API wasn't filtering by postal code correctly, returning properties from wrong zip codes.
- **Solution**: Applied server-side filtering for postal codes, cities, and subdivisions after fetching data from HomeReview.
- **Data Source**: Switched to HomeReview as primary data source for all searches (Active, Under Contract, Closed) since it has better filtering support than MLS Grid's limited OData API.
- **MLS Grid Limitation**: MLS Grid OData API doesn't support filtering on many fields (ListPrice, BedroomsTotal, etc.), so it's only used as a fallback.
- **Fetch Strategy**: When location filters are specified, fetch up to 500 properties and filter server-side to ensure accurate results.

### Shareable CMA Links with Security Hardening (Dec 6, 2025)
- **Share Tokens**: Added ability to generate shareable links for CMAs that expire after 30 days.
- **Public Route**: Created `/share/cma/:token` route for public viewing of shared CMAs without authentication.
- **Security**: Share endpoints require authentication and ownership verification. Only CMA owners can generate/revoke share links.
- **Sanitized Response**: Public CMA view excludes internal notes and user IDs to protect sensitive agent information.
- **UI**: CMADetailPage now includes a Share dialog with copy-to-clipboard functionality and link management.

### HomeReview API Integration (Dec 6, 2025)
- **New Data Source**: Replaced direct MLS Grid API with HomeReview-AI Replit app as the primary data source.
- **API Client**: Created `server/homereview-client.ts` to fetch properties, neighborhoods, and market stats from the HomeReview API.
- **Proxy Endpoints**: Added `/api/homereview/properties`, `/api/homereview/neighborhoods`, and `/api/homereview/stats` endpoints in `server/routes.ts`.
- **Data Volume**: 83,335 properties available including sold data from 1996-present.
- **Field Mapping**: HomeReview API uses camelCase field names (listingId, closePrice, etc.) - mapper updated accordingly.
- **Environment Variable**: `HOMEREVIEW_API_URL` controls the API endpoint (defaults to development URL).

### Array Filter Validation Fix (Nov 21, 2025)
- **Comprehensive Schema Update**: Fixed "Expected array, received string" validation errors across ALL array-based search filters by implementing the `stringOrArray` transformer in the Zod schema.
- **Fields Fixed**: Updated 40+ array fields including subdivisions, cities, schools, property features, amenities, utilities, and all multi-select filters to accept both string and array inputs.
- **Root Cause**: When users selected a single value for any multi-select filter, Express delivered it as a string instead of an array, causing Zod validation to fail. The `stringOrArray` transformer automatically handles both cases.
- **Impact**: Eliminated "Error Loading properties" errors; all search filters now work reliably with single or multiple selections.

### Property Search Performance Optimization (Nov 21, 2025)
- **Database-Level Pagination**: Implemented LIMIT/OFFSET at the database query level instead of in-memory slicing, dramatically improving performance when searching large datasets (65,649+ properties).
- **Trigram Index**: Enabled `pg_trgm` extension and created a GIN trigram index on the `subdivision` column for fast partial text search using ILIKE queries.
- **Subdivision Search Fix**: Added query parameter transformation logic to handle both `subdivision.values` (array format) and `subdivision` (singular format) query parameters, converting them to the `subdivisions` array expected by the backend schema.
- **Performance Impact**: Subdivision searches now respond in <1 second instead of timing out (previously >30 seconds).

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite for development and bundling. It utilizes `shadcn/ui` (New York style variant) based on Radix UI for its component system, prioritizing visual appeal for client engagement and functional efficiency for agents. Styling is managed with Tailwind CSS, incorporating custom design tokens for consistency and supporting light/dark modes. State management is handled by TanStack Query with aggressive caching, and Wouter provides lightweight client-side routing. Key pages include Dashboard, Property Search, Property Detail, CMA management, and CMA report generation.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript, using an ESM module system. It exposes a RESTful API with type-safe request/response handling for properties, CMAs, and system health checks. A flexible storage interface (`IStorage`) supports in-memory, database (PostgreSQL via Drizzle ORM), and hybrid storage solutions. The system includes a built-in rate limiter to comply with MLS Grid API usage policies, automatically queuing and delaying requests to maintain limits (2 req/sec, 7200 req/hour).

### Database Schema

The platform uses Drizzle ORM with PostgreSQL, adhering to type-safe schema definitions. Core tables include `properties` (RESO Data Dictionary compliant data), `media` (for property images), `saved_searches`, and `cmas`. Zod schemas are used for runtime validation, generated from Drizzle schemas. The design philosophy strictly follows the MLS Grid's RESO Data Dictionary standard while accommodating MLS-specific fields.

## External Dependencies

- **MLS Grid API**: The primary data source for property listings, providing data from various MLS systems. It handles authentication, automated data synchronization, and RESO Data Dictionary standardization.
- **PostgreSQL**: Used for persistent data storage in production environments, leveraging the Neon serverless driver.
- **Amazon S3**: Utilized for storing media assets, such as property images and documents.
- **`connect-pg-simple`**: Provides PostgreSQL-backed session management.
- **Google Fonts CDN**: Used for typography, specifically the Inter font family.
- **Recharts**: Integrated for charting and data visualization within CMA reports.
- **SendGrid**: Used for email services, such as sending seller updates.