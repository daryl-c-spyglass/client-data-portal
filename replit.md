# MLS Grid IDX/CMA Platform

## Overview

This is a professional real estate IDX (Internet Data Exchange) platform powered by MLS Grid API integration. The platform enables real estate agents to search properties, create Comparative Market Analyses (CMAs), and share insights with clients. It combines property browsing capabilities inspired by leading real estate platforms (Zillow, Redfin, Realtor.com) with productivity-focused workflow tools.

## Recent Changes (November 20, 2025)

### Completed Features (Tasks 1-5) ✅

**Quick Seller Update System (Tasks 1-4)**
1. Email Templates: Professional HTML email templates with property cards, market summary statistics, and responsive design (server/email-templates.ts)
2. Email Scheduler: Hourly background job that processes due seller updates based on frequency (daily/weekly/bi-weekly/monthly), integrates with SendGrid API, handles graceful fallback when API key is not configured (server/email-scheduler.ts)
3. Server Integration: Scheduler starts automatically with server, runs every hour (server/index.ts)
4. Market Summary Enhancement: Added avgPricePerSqft calculation to market statistics (server/seller-update-service.ts)
5. Embeddable Widget: Standalone form page without sidebar navigation for iframe embedding on external websites (client/src/pages/SellerUpdateEmbed.tsx)
6. Embed Code Generator: UI tool to generate iframe embed codes with standard, responsive, and WordPress formats (client/src/pages/EmbedCodeGenerator.tsx)
7. Guest User Handling: POST /api/seller-updates endpoint creates or finds users by email for embeddable widget submissions
8. **Bug Fixes**: Fixed apiRequest parameter order (url, method, data) to resolve form submission errors

**Buyer Search System (Task 5)**
1. Comprehensive Search UI: 20+ filters organized in tabs (Basic, Location, Details) including status, price range, beds/baths, living area, property type, location fields (zip, city, neighborhood, subdivision, MLS area), schools (elementary, middle, high), lot size, year built, and list date range (client/src/pages/BuyerSearch.tsx)
2. Active Filter Tracking: Badge display showing number of active filters with individual clear buttons
3. Filter Organization: Collapsible filter panel with toggle visibility
4. Results Display: Property card grid with loading states and empty state messaging
5. Navigation Integration: Added to sidebar with Filter icon

**Testing Status**
- ✅ Seller Update Embed Form: End-to-end tested successfully (creates records, shows success UI, creates guest users)
- ✅ Email Scheduler: Running hourly, processing updates based on frequency
- ✅ All critical bugs resolved and verified

**Remaining Features (Tasks 6-12)**
- Task 6: Interactive map with polygon drawing
- Task 7: Saved buyer searches
- Tasks 8-10: CMA Builder enhancements and report tabs
- Tasks 11-12: Collaboration features (property suggestions and commenting)

### Previous Session Changes

### Property Listing UI Enhancements
Completed comprehensive improvements to property browsing and display:

1. **Enhanced PropertyCard Component**: Improved visual design with better property details (type, price/sqft, year built), proper edge-case handling for studios (0 beds) and missing location data, and polished styling.

2. **Multi-Sort Functionality**: Added global sorting across all view modes (grid, list, table) with options for price (low/high), date (newest/oldest), and status, with consistent sort order maintained when switching views.

3. **Status Filtering Tabs**: Implemented status-based filtering with tabs for All, Active, Pending, Under Contract, and Closed properties, including accurate property counts per status.

4. **List View**: Created PropertyListCard component providing horizontal property cards with image, details, and actions in a compact row format for efficient browsing.

5. **Table View**: Implemented PropertyTable with sortable columns (address, price, beds, baths, sqft, status, days on market) and visual sort indicators, ideal for data comparison.

6. **Pagination System**: Added "Load More" functionality showing 20 properties initially with ability to load additional properties incrementally, including accurate "Showing X of Y" counters that reset properly on filter/sort changes.

### Backend Bug Fixes

1. **MLS Grid Sync Upsert Logic**: Fixed duplicate key constraint violations by using `getPropertyByListingId` instead of `getProperty` when checking for existing properties during sync, ensuring proper updates instead of failed inserts.

2. **API Pagination**: Added default limit of 1000 properties to GET /api/properties endpoint to prevent Node.js out-of-memory errors when serializing large datasets (65,615 properties). Supports optional limit and offset query parameters.

### Current Database Status
- **Total Properties**: 65,615 synced from MLS Grid
- **Media Sync**: Known issue - Media endpoint returns 400 error (likely permissions), but property data sync is fully functional

### Quick Seller Update Feature (In Progress)
Started implementation of embeddable "Quick Seller Update" widget duplicating Follow Up Boss functionality:
- **Database Schema**: Added `seller_updates` table with fields for postalCode, elementarySchool, propertySubType, emailFrequency, and tracking
- **Storage Layer**: Implemented CRUD operations in both MemStorage and DbStorage
- **Email Integration**: Configured for SendGrid via SENDGRID_API_KEY environment variable (optional - can be added when ready to send emails)
- **Next Steps**: API routes, property matching logic, email templates, UI pages, and embeddable widget

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Component System**: shadcn/ui (New York style variant) built on Radix UI primitives, providing accessible and customizable components. The design system emphasizes:
- Visual appeal for client engagement (property imagery takes center stage)
- Functional efficiency for agent workflow
- Hybrid reference strategy drawing from industry-leading real estate platforms

**Styling**: Tailwind CSS with custom design tokens for consistent spacing (2, 4, 6, 8, 12, 16, 20, 24), typography (Inter font family), and theming. Supports light/dark mode through CSS variables.

**State Management**: TanStack Query (React Query) for server state management with aggressive caching (`staleTime: Infinity`) to minimize API calls.

**Routing**: Wouter for lightweight client-side routing.

**Key Pages**:
- Dashboard: Overview of properties and CMAs
- Properties: Search interface with criteria filtering and results display
- Property Detail: Individual property viewing with media gallery
- CMAs: List of comparative market analyses
- CMA Builder: Tool for creating new CMAs with subject property and comparables selection
- CMA Report: Visualization with charts, statistics, and property comparisons

### Backend Architecture

**Runtime**: Node.js with Express framework.

**Language**: TypeScript with ESM module system.

**API Design**: RESTful API with type-safe request/response handling. Key endpoints include:
- `/api/properties` - Property listing and search
- `/api/properties/search` - Advanced search with criteria
- `/api/cmas` - CMA management
- `/api/health` - System health check (MLS Grid configuration status)

**Data Storage Strategy**: Abstract storage interface (`IStorage`) allowing multiple implementation options:
- In-memory storage for development/demo
- Database storage (designed for PostgreSQL via Drizzle ORM)
- Hybrid approach with seed data when MLS Grid API is not configured

**Rate Limiting**: Built-in rate limiter for MLS Grid API compliance:
- 2 requests per second
- 7200 requests per hour
- Automatic request queuing and delay injection

### Database Schema

**ORM**: Drizzle ORM configured for PostgreSQL with type-safe schema definitions.

**Core Tables**:
- `properties` - RESO Data Dictionary compliant property data including address, pricing, features, location coordinates, and metadata
- `media` - Property images and media assets with S3 integration
- `saved_searches` - User-saved search criteria
- `cmas` - Comparative Market Analysis records with subject property and comparables

**Schema Validation**: Zod schemas for runtime validation, generated from Drizzle schemas for consistency.

**Design Philosophy**: Full adherence to MLS Grid's RESO Data Dictionary standard while preserving non-conforming MLS-specific fields.

### External Dependencies

**MLS Grid API**: Primary data source for property listings, integrating with multiple MLS systems through a unified interface.
- Authentication: Bearer token authentication
- Data import: Automated sync (every minute when unrestricted) with timestamp delta queries
- Data conversion: RESO Data Dictionary standardization
- Media handling: S3 storage for property images

**Database**: PostgreSQL (via Neon serverless driver) for production data persistence.

**CDN/Asset Storage**: Amazon S3 for media asset storage (property images, documents).

**Session Management**: PostgreSQL-backed session store using `connect-pg-simple`.

**Development Tools**:
- Replit-specific plugins for development banner, error overlay, and source mapping
- Google Fonts CDN for Inter typography

**Charting**: Recharts for data visualization in CMA reports (price trends, market statistics).