# Mission Control | Client Data Portal

## Overview
This project is Spyglass Realty's centralized Client Data Portal — a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing with robust, productivity-focused workflow features to streamline real estate operations, aspiring to be a leading tool in the real estate market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript using Vite, utilizing `shadcn/ui` (New York style variant) based on Radix UI for components and Tailwind CSS for styling, supporting light/dark modes. State management uses TanStack Query with aggressive caching, and Wouter for client-side routing. The UI incorporates Spyglass Realty branding with an orange primary color scheme. Mapbox is the standard mapping library.

### Backend Architecture
The backend is developed with Node.js and Express in TypeScript (ESM), exposing a RESTful API with type-safe request/response handling. It features a flexible storage interface, a built-in rate limiter, and a scheduled daily sync for property data. The API intelligently routes property searches: active/under_contract listings query the Repliers API, while closed/sold listings query the local PostgreSQL database.

### Database Schema
The platform uses Drizzle ORM with PostgreSQL, adhering to type-safe schema definitions. Core tables include `properties` (RESO Data Dictionary compliant), `media`, `saved_searches`, and `cmas`. Zod schemas are used for runtime validation. Property search performance is optimized with database-level pagination and trigram indexes.

### UI/UX Decisions
The UI incorporates Spyglass Realty branding with an orange primary color scheme. `shadcn/ui` (New York style variant) based on Radix UI is used for components. Styling is managed with Tailwind CSS, incorporating custom design tokens and supporting light/dark modes. Mapbox is the standard mapping library. A centralized `statusColors.ts` manages property status colors for consistency across the application. Global Day/Night Mode is managed via `ThemeContext` with localStorage persistence, and maps automatically sync their visual style.

### Authentication
Google OAuth is used for team-only authentication with domain restriction. Session management is PostgreSQL-backed. Security features include return URL sanitization and CSP headers for iframe embedding. A 4-tier role system (Developer, Super Admin, Admin, Agent) provides role-based access control with permissions managed via utilities and hooks. User management features include role changes, account enabling/disabling, and permanent deletion with activity logging.

### Technical Implementations
Primary property data is sourced from Repliers API and MLS Grid API. CMA searches utilize a two-query strategy for active/under_contract vs. closed listings. A daily scheduled refresh syncs Repliers inventory. Property status handling adheres to the RESO Data Dictionary. A canonical data layer unifies and deduplicates listing data. AI features include a conversational property search and CMA intake assistant, natural language search for property criteria, and visual similarity ranking for property listings. School filtering is handled at the API level for active listings and server-side for closed listings.

### Feature Specifications
- **IDX Platform**: Comprehensive property browsing, search, and filtering.
- **CMA Generation**: Tools for creating detailed CMAs with professional reports, customizable sections, branding, AI-powered cover letters and photo selection. Includes interactive Mapbox integration and property value adjustment features.
- **Agent Productivity Tools**: Integrations with Mission Control (ReZen) and Follow Up Boss (FUB) for reporting, calendar events, and lead management, with role-based data access.
- **Seller Updates**: Automated market update emails.
- **Settings Page**: Agent profile, data sync, display preferences, embed codes, and lead capture.
- **Admin Panel**: Company branding, custom report pages, and user role management.
- **Deployment Log**: Developer-only audit trail for tracking code changes and deployments across Replit, Vercel, Render, and GitHub. Supports commit hash, change type, status tracking (pending → deployed/failed), requester info, and filtering/search. Located at `/admin/deployment-logs` with full CRUD API. Includes inbound webhook handlers (`/api/webhooks/github|vercel|render`) for real-time tracking and on-demand API sync endpoints (`POST /api/deployment-logs/sync/vercel` and `POST /api/deployment-logs/sync/github`) with "Sync Vercel" / "Sync GitHub" buttons on the page. Requires `VERCEL_API_TOKEN` and `GITHUB_TOKEN` + `GITHUB_REPO` env vars for API sync.
- **Market Insights**: Year-over-Year price comparisons and neighborhood-level market statistics.
- **Property Detail Page**: Enhanced property details with neighborhood reviews and boundary maps.
- **Search Enhancements**: Autocomplete for cities, zip codes, subdivisions, elementary schools, and Quick Search (address/MLS# property autocomplete with debounced suggestions via `/api/properties/autocomplete`).
- **Dynamic Map Layers**: Toggle-able flood zone and school district overlays on property maps.

## External Dependencies

- **MLS Grid API**: Primary data source for property listings.
- **Repliers API**: Primary data source for active, pending, and closed property listings.
- **PostgreSQL**: Persistent data storage (Neon serverless driver).
- **Amazon S3**: Storage for media assets.
- **Replit Object Storage**: For CMA listing brochure uploads.
- **Mission Control (ReZen) API**: For agent production volume reporting.
- **Follow Up Boss (FUB) API**: For calendar events and lead management.
- **Google Fonts CDN**: Typography (Inter font family).
- **Resend**: Email services.
- **FEMA NFHL API**: National Flood Hazard Layer data.
- **City of Austin ArcGIS**: School district boundary data.
- **Mapbox GL JS**: Standard mapping library.
- **OpenAI API**: For AI Assistant and AI Search Assistant functionalities (GPT-4o).
- **WordPress Integration API**: Provides endpoints for listing properties, search, and user favorites.