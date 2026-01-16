# MLS Grid IDX/CMA Platform

## Overview
This project is a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing with robust, productivity-focused workflow features to streamline real estate operations, aspiring to be a leading tool in the real estate market.

## User Preferences
Preferred communication style: Simple, everyday language.
**Mapping Solution**: Mapbox is the standard mapping library for all features across the application. All interactive maps, property visualizations, and location-based features should use Mapbox GL JS. Requires VITE_MAPBOX_TOKEN secret.
- **Centralized Map Colors**: `client/src/lib/mapColors.ts` - Single source of truth for all map marker colors (Active=#22c55e, AUC=#f97316, Pending=#eab308, Closed=#6b7280, Subject=#ef4444) and Mapbox style URLs (streets, satellite, dark).
- **Reusable MapboxMap Component**: `client/src/components/shared/MapboxMap.tsx` - Standard component for property maps with markers, price labels, popups, auto-fit bounds, legend, polygon overlays, and static map URL generation for PDF export. Supports theme synchronization via `syncWithTheme` and `currentTheme` props.
- **Global Day/Night Mode**: ThemeContext (`client/src/contexts/ThemeContext.tsx`) provides application-wide theme state with localStorage persistence ('cdp-theme'). Maps automatically sync their visual style (streets for light mode, dark for dark mode) when `syncWithTheme={true}` is passed to MapboxMap.
- **Polygon Persistence**: MapboxMap uses reusable `addPolygonToMap()` function called both on initial render and after theme-triggered style changes to ensure polygon overlays persist across theme toggles.
- **Migration Status**: CMAReport.tsx, PropertyDetail.tsx, PropertyMapView.tsx, NeighborhoodReview.tsx fully migrated to Mapbox with theme sync. Remaining files using Leaflet: MapLayersControl.tsx (flood zones/school districts), PolygonMapSearch.tsx (requires mapbox-gl-draw for drawing tools).

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript using Vite, utilizing `shadcn/ui` (New York style variant) based on Radix UI for components and Tailwind CSS for styling, supporting light/dark modes. State management uses TanStack Query with aggressive caching, and Wouter for client-side routing. The UI incorporates Spyglass Realty branding with an orange primary color scheme.

### Backend Architecture
The backend is developed with Node.js and Express in TypeScript (ESM), exposing a RESTful API with type-safe request/response handling. It features a flexible storage interface, a built-in rate limiter, and a scheduled daily sync for property data. The API intelligently routes property searches: active/under_contract listings query the Repliers API, while closed/sold listings query the local PostgreSQL database.

### Database Schema
The platform uses Drizzle ORM with PostgreSQL, adhering to type-safe schema definitions. Core tables include `properties` (RESO Data Dictionary compliant), `media`, `saved_searches`, and `cmas`. Zod schemas are used for runtime validation. Property search performance is optimized with database-level pagination and trigram indexes.

### UI/UX Decisions
The UI incorporates Spyglass Realty branding with an orange primary color scheme. `shadcn/ui` (New York style variant) based on Radix UI is used for components, prioritizing visual appeal and functional efficiency. Styling is managed with Tailwind CSS, incorporating custom design tokens and supporting light/dark modes.

### Authentication
- **Google OAuth**: Team-only authentication via Google OAuth (passport-google-oauth20).
- **Domain Restriction**: Access limited to @spyglassrealty.com emails or explicitly allowed emails.
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple.
- **Auth Routes**: `/auth/google` (initiate), `/auth/google/callback` (callback), `/auth/logout` (logout), `/api/auth/me` (current user).
- **Public Routes**: `/login`, `/embed/seller-update`, `/share/cma/:token` are accessible without authentication.
- **Security**: Return URL sanitization prevents open redirect vulnerabilities.
- **User Schema**: Supports both password-based and OAuth users (passwordHash optional, googleId for OAuth).

### Technical Implementations
- **Data Sourcing**: Primary property data from Repliers API (active, pending, closed listings) and MLS Grid API.
- **Repliers Subdivision Data**: IMPORTANT - Repliers API stores MLS SubdivisionName data in the `address.neighborhood` field. All other subdivision fields (address.subdivision, raw.SubdivisionName) are undefined. This is a Repliers data contract limitation, not a code choice.
- **CMA Two-Query Strategy**: CMA searches use two logical filter paths (not two HTTP requests, since Repliers allows only one standardStatus per call). Active/UC path uses local subdivision filtering with multi-page fetching to preserve listings with missing/divergent neighborhood data. Closed path uses API-level subdivision filtering (`search` + `searchFields=address.neighborhood`) and date filtering (`minSoldDate` in YYYY-MM-DD format). Default close date range is 365 days.
- **Repliers Inventory Sync**: Scheduled daily refresh at 12 AM Central (CST/CDT) with manual trigger support via `/api/admin/repliers/sync`. Status endpoint at `/api/admin/repliers/sync/status`.
- **Location Data**: Neighborhood information derived from boundary polygon resolution.
- **Caching**: In-memory caches for frequently accessed external API data (e.g., FUB, ReZen).
- **Rate Limiting**: Manages external API requests to comply with usage policies.
- **Inventory Service**: Efficient aggregate-based counting using RESO standardStatus (Active, Active Under Contract, Pending, Closed) with a 5-minute cache TTL.
- **Property Status Handling**: All user-facing status labels strictly follow the RESO Data Dictionary 4-status hierarchy (Active, Active Under Contract, Pending, Closed).
- **Canonical Data Layer**: Unifies MLS and Repliers listings data with deterministic deduplication, prioritizing MLS > REPLIERS > DATABASE.
- **AI Assistant**: Conversational property search and CMA intake assistant powered by OpenAI GPT-4o, including voice input and intent detection (`IDX_SEARCH`, `CMA_INTAKE`). Requires user confirmation for CMA creation.
- **AI Search Assistant**: Natural language search for property criteria in Buyer Search, using OpenAI for parsing and sanitization with RESO-compliant validation.
- **AI Image Search**: Visual similarity ranking for property listings powered by Repliers AI, integrated into Buyer Search and CMA Builder for finding visually similar comps.
- **Property Type Filtering**: Post-fetch filtering handles Repliers API limitations for property types like "Single Family" and "Land," using regex-based exclusions. PropertyTypeGuard recognizes "Single Family Residence" from UI dropdown.
- **School Filter Architecture**: Repliers API handles school filtering at API level for Active/Under Contract/Pending statuses using `raw.ElementarySchool=contains:` format. Local server-side school filtering is skipped for Repliers results to prevent double-filtering. Database results (Closed status) use local school filter with normalized matching.

### Feature Specifications
- **IDX Platform**: Comprehensive property browsing, search, and filtering.
- **CMA Generation**: Tools for creating detailed Comparative Market Analyses.
- **Agent Productivity Tools**: Integrations with Mission Control (ReZen) for production volume reporting and Follow Up Boss (FUB) for calendar events and lead management.
- **Seller Updates**: Automated market update emails for sellers with SendGrid integration. Supports configurable frequency (weekly, bimonthly, quarterly), test emails, active/pause toggle, and send history tracking. Cron job runs daily at 9 AM Central to send due emails.
- **Settings Page**: Management for agent profile (headshot, bio, title, cover letter, social links), data sync, display preferences, embed codes, and lead capture. **Profile Photo Upload**: Agents can upload profile photos (max 5MB, JPG/PNG) via object storage or paste external image URLs. Upload uses presigned URL flow via `/api/uploads/request-url`. Photos are stored as object paths (e.g., `/objects/uploads/uuid`) and served via the object storage routes.
- **Admin Panel**: Master admin controls for company branding (logo, colors), custom report pages, and user role management. Access restricted to admin users.
- **CMA Presentation Builder**: Professional CMA report creation with agent profiles, customizable sections (17 sections in 3 categories), and company branding. Features include section toggles with ordering, cover letter customization, layout options (landscape/portrait), live preview with enhanced UX (expand modal, zoom controls 50%/100%/150%, visual update feedback, clickable sections that navigate to settings), agent footer toggle, and listing brochure upload/management. Brochure support includes PDF and image upload (up to 10MB) with preview, stored via Replit Object Storage. Image brochures are included in PDF export. **Mapbox Integration**: Interactive "Map of All Listings" section with multi-style support (streets/satellite/dark), property markers with status color-coding (Active=#22c55e, AUC=#f97316, Pending=#eab308, Closed=#6b7280, Subject=#ef4444), optional search area polygon overlay, and static map URL generator for PDF export. Map settings (style, polygon toggle) are persisted in cma_report_configs. Requires VITE_MAPBOX_TOKEN secret. **AI Cover Letter Generation**: CoverLetterEditor component with AI-powered letter generation using GPT-4o, supporting property context and agent personalization. **AI-Powered Photo Selection**: PhotoSelectionModal with Repliers imageInsights API integration for AI-classified photo quality rankings, category filtering (exterior, kitchen, living, bedroom, bathroom, other), and custom photo selection with numbered order badges and max limit enforcement. Photo layout options include first_dozen, ai_suggested, and custom modes. Custom selections persisted in cma_report_configs.customPhotoSelections field. Photo insights API at /api/repliers/listings/:mlsNumber/photo-insights returns consistent 200 responses with error flags (api_not_configured, listing_not_found, fetch_failed) for proper error handling. **Editable Cover Page**: CoverPageEditor component with customizable title, subtitle, date/agent photo toggles, and background style options (plain, gradient, property). Cover page config persisted in cma_report_configs.coverPageConfig field. **Report Templates**: Save report configurations as reusable templates via SaveAsTemplateModal with template name and set-as-default option. Template API endpoints: GET/POST/DELETE /api/report-templates with Zod validation. Access via /cmas/:id/presentation. Database tables: agent_profiles, company_settings, custom_report_pages, cma_report_configs (includes mapStyle, showMapPolygon, customPhotoSelections, coverPageConfig fields), cma_report_templates. CMA schema includes brochure field (jsonb) for storing brochure metadata.
- **Market Insights**: Year-over-Year price comparisons and neighborhood-level market statistics.
- **Property Detail Page**: Enhanced property details with neighborhood reviews and boundary maps.
- **Search Enhancements**: Autocomplete for cities, zip codes, subdivisions, and elementary schools.
- **Dynamic Map Layers**: Toggle-able flood zone (FEMA NFHL) and school district (City of Austin GIS) overlays on property maps with interactive legends.
- **Dev Tools**: Status Inspector component for debugging MLS parity issues in development.

## External Dependencies

- **MLS Grid API**: Primary data source for property listings.
- **Repliers API**: Primary data source for active, pending, and closed property listings.
- **PostgreSQL**: Persistent data storage, leveraging Neon serverless driver.
- **Amazon S3**: Storage for media assets.
- **Replit Object Storage**: Used for CMA listing brochure uploads (GCS-backed with presigned URL flow).
- **Mission Control (ReZen) API**: For agent production volume reporting.
- **Follow Up Boss (FUB) API**: For calendar events and lead management.
- **`connect-pg-simple`**: PostgreSQL-backed session management.
- **Google Fonts CDN**: Typography (Inter font family).
- **Recharts**: Charting and data visualization.
- **Resend**: Email services for seller update notifications.
- **FEMA NFHL API**: National Flood Hazard Layer data for flood zone overlays.
- **City of Austin ArcGIS**: School district boundary data for map layers.
- **Mapbox GL JS**: Standard mapping library for all application features including CMA presentations, property detail pages, and location-based visualizations. Supports multiple styles (streets/satellite/dark), property markers with status color-coding, and interactive overlays.

### WordPress Integration API
A dedicated API at `/api/wordpress/*` with CORS enabled for `spyglassrealty.org` provides endpoints for listing properties, retrieving single property details, advanced search, and managing user favorites.