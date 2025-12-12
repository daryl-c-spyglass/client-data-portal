# MLS Grid IDX/CMA Platform

## Overview

This project is a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing (similar to Zillow or Redfin) with robust, productivity-focused workflow features to streamline real estate operations.

## Recent Changes (Dec 12, 2025)

- **CMA Report UI Refinements**:
  - Renamed "Listings & Map" tab to "Listings" in CMA results
  - Synced listing filter pills (All/Sold/Active/Under Contract) with Property Location map markers
  - Restructured Listings tab: stats cards + property list (left) | map (right, sticky) | Price Distribution (full width below)
  - Removed duplicate "Property Locations Overview" from Market Stats tab
- **Print/PDF Improvements**: Comprehensive print CSS for document-like PDF output with proper page breaks, hidden navigation, white backgrounds, single-column stacking for grids, and scrollbar artifact removal
- **Properties Page Cleanup**: Removed unused "Send Properties" and "Quick CMA" buttons from search form
- **Property Type Formatter**: Added centralized `formatPropertyType()` utility in `client/src/lib/property-type-utils.ts` for consistent property type display across all components
- **Recent Sold Photos**: Updated `/api/dashboard/recent-sold` endpoint to fetch photos from media table
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