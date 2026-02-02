# MLS Grid IDX/CMA Platform

## Overview
This project is a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing with robust, productivity-focused workflow features to streamline real estate operations, aspiring to be a leading tool in the real estate market.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React and TypeScript using Vite, utilizing `shadcn/ui` (New York style variant) based on Radix UI for components and Tailwind CSS for styling, supporting light/dark modes. State management uses TanStack Query with aggressive caching, and Wouter for client-side routing. The UI incorporates Spyglass Realty branding with an orange primary color scheme.

### Backend Architecture
The backend is developed with Node.js and Express in TypeScript (ESM), exposing a RESTful API with type-safe request/response handling. It features a flexible storage interface, a built-in rate limiter, and a scheduled daily sync for property data. The API intelligently routes property searches: active/under_contract listings query the Repliers API, while closed/sold listings query the local PostgreSQL database.

### Database Schema
The platform uses Drizzle ORM with PostgreSQL, adhering to type-safe schema definitions. Core tables include `properties` (RESO Data Dictionary compliant), `media`, `saved_searches`, and `cmas`. Zod schemas are used for runtime validation. Property search performance is optimized with database-level pagination and trigram indexes.

### UI/UX Decisions
The UI incorporates Spyglass Realty branding with an orange primary color scheme. `shadcn/ui` (New York style variant) based on Radix UI is used for components, prioritizing visual appeal and functional efficiency. Styling is managed with Tailwind CSS, incorporating custom design tokens and supporting light/dark modes.
**Mapping Solution**: Mapbox is the standard mapping library for all features across the application. All interactive maps, property visualizations, and location-based features should use Mapbox GL JS. Requires VITE_MAPBOX_TOKEN secret.
- **Centralized Status Colors**: `client/src/lib/statusColors.ts` - Single source of truth for all property status colors used across the entire portal (maps, cards, tables, badges, charts, PDF exports). Color scheme: Subject=#3b82f6 (blue), Active=#22c55e (green), Under Contract=#f97316 (orange), Closed=#ef4444 (red), Pending=#6b7280 (gray). Includes Tailwind classes, hex values, and helper functions like `getStatusHexFromMLS()` and `getStatusFromMLS()`.
- **Global Day/Night Mode**: ThemeContext (`client/src/contexts/ThemeContext.tsx`) provides application-wide theme state with localStorage persistence ('cdp-theme'). Maps automatically sync their visual style (streets for light mode, dark for dark mode) when `syncWithTheme={true}` is passed to MapboxMap. CMA map view includes a Streets/Satellite toggle; satellite view remains satellite regardless of theme, while streets view adapts to dark/light theme.

### Authentication
- **Google OAuth**: Team-only authentication via Google OAuth (passport-google-oauth20) with domain restriction to @spyglassrealty.com emails or explicitly allowed emails.
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple. Cookies configured with `sameSite: 'none'` and `secure: true` for cross-origin iframe support.
- **Security**: Return URL sanitization prevents open redirect vulnerabilities. CSP headers allow iframe embedding from `*.replit.dev`, `*.replit.app`, `*.onrender.com`, `*.spyglassrealty.com`.
- **Iframe Embedding (Popup OAuth)**: When embedded in an iframe (e.g., Mission Control / Agent Hub Portal), authentication uses popup-based OAuth flow since Google blocks OAuth redirects in iframes. Implementation in `client/src/lib/iframe.ts` with `isInIframe()` detection and `openAuthPopup()` helper. Server routes: `/auth/google/popup` initiates popup flow, callback uses postMessage to communicate success/error to parent window. Auto dark theme sync when embedded.
- **3-Tier Role System**: Role-based access control with Super Admin > Admin > Agent hierarchy.
  - **Super Admin**: Full platform access including user management, presentation library management, company settings. Initial super admins: ryan@, daryl@, caleb@ @spyglassrealty.com (defined in `INITIAL_SUPER_ADMIN_EMAILS` as fallback for first-time setup)
  - **Admin**: Template creation, presentation library viewing, display settings management
  - **Agent**: CMA creation, presentations, global slides access, analytics viewing
  - **Permission Utilities**: `shared/permissions.ts` exports `hasPermission()`, `isAtLeast()`, `normalizeRole()`, `INITIAL_SUPER_ADMIN_EMAILS` helpers
  - **Frontend Hook**: `usePermissions()` hook provides `can()`, `isAtLeast()`, role flags
  - **Backend Middleware**: `requireMinimumRole()` and `requirePermission()` in `server/auth.ts`. Auth middleware checks `isActive` status to block disabled users.
  - **Protected Routes**: `ProtectedRoute` component wraps pages requiring specific roles/permissions
  - **User Management** (`/admin/users`): Super Admin page for viewing all users, changing roles, enabling/disabling accounts, and permanently deleting users. Features: search with Follow Up Boss team member integration (FUB users shown separately if not yet registered), status badges, inline role dropdown for invites, action dropdowns, confirmation dialogs. Protection rules enforced server-side: cannot change own role/status, cannot disable/delete super admins (must demote first), cannot delete yourself, cannot remove last super admin.
  - **Permanent User Deletion**: DELETE /api/admin/users/:id endpoint with activity logging (USER_DELETED action with deletedUserEmail, deletedUserName, deletedUserRole details). Foreign key constraint uses ON DELETE SET NULL to preserve activity logs after user deletion.
  - **Activity Logs** (`/admin/activity-logs`): Audit trail of admin actions (role changes, user enable/disable, user deleted, user invited). Stored in `admin_activity_logs` table with admin/target user info, IP address, previous/new values, details JSONB. Service in `server/admin-activity-service.ts`. Deleted user info preserved in details field when targetUser is NULL.
  - **User Status Control**: `isActive` boolean on users table enables soft disable. Disabled users cannot log in but data is preserved.

### Technical Implementations
- **Data Sourcing**: Primary property data from Repliers API (active, pending, closed listings) and MLS Grid API. Repliers API stores MLS SubdivisionName data in `address.neighborhood`.
- **CMA Two-Query Strategy**: CMA searches use two logical filter paths for active/under_contract listings (local subdivision filtering with multi-page fetching) and closed listings (API-level subdivision filtering and date filtering). Default close date range is 365 days.
- **Repliers Inventory Sync**: Scheduled daily refresh at 12 AM Central with manual trigger support.
- **Property Status Handling**: All user-facing status labels strictly follow the RESO Data Dictionary 4-status hierarchy (Active, Active Under Contract, Pending, Closed).
- **Canonical Data Layer**: Unifies MLS and Repliers listings data with deterministic deduplication, prioritizing MLS > REPLIERS > DATABASE.
- **AI Assistant**: Conversational property search and CMA intake assistant powered by OpenAI GPT-4o, including voice input and intent detection (`IDX_SEARCH`, `CMA_INTAKE`). Requires user confirmation for CMA creation.
- **AI Search Assistant**: Natural language search for property criteria in Buyer Search, using OpenAI for parsing and sanitization with RESO-compliant validation.
- **AI Image Search**: Visual similarity ranking for property listings powered by Repliers AI, integrated into Buyer Search and CMA Builder for finding visually similar comps.
- **School Filter Architecture**: Repliers API handles school filtering at API level for Active/Under Contract/Pending statuses. Local server-side school filtering is used for Database results (Closed status).

### Feature Specifications
- **IDX Platform**: Comprehensive property browsing, search, and filtering.
- **CMA Generation**: Tools for creating detailed Comparative Market Analyses with professional report building, agent profiles, customizable sections, company branding, and AI-powered cover letter generation (GPT-4o) and photo selection (Repliers imageInsights API). Includes interactive Mapbox integration for listing visualization and static map URL generation for PDF export.
- **CMA Property Adjustments**: Full property value adjustment feature for CMA comparisons with configurable adjustment rates (sqft: $50/unit, bedrooms: $10K, bathrooms: $7.5K, pool: $25K, garage: $5K/space, year built: $1K/year, lot size: $2/sqft). Supports per-comparable manual overrides and custom adjustments. Data stored in `cmas.adjustments` JSONB column with types: `CmaAdjustmentRates`, `CmaCompAdjustmentOverrides`, `CmaAdjustmentsData`. Calculation library at `client/src/lib/adjustmentCalculations.ts`. UI component at `client/src/components/AdjustmentsSection.tsx`. Uses `getPropertyId(comp)` helper for consistent comparable identification across storage and preview calculations.
- **Agent Productivity Tools**: Integrations with Mission Control (ReZen) for production volume reporting and Follow Up Boss (FUB) for calendar events and lead management.
- **Seller Updates**: Automated market update emails with SendGrid integration.
- **Settings Page**: Management for agent profile, data sync, display preferences, embed codes, and lead capture, including profile photo uploads to object storage.
- **Admin Panel**: Master admin controls for company branding, custom report pages, and user role management.
- **Market Insights**: Year-over-Year price comparisons and neighborhood-level market statistics.
- **Property Detail Page**: Enhanced property details with neighborhood reviews and boundary maps.
- **Search Enhancements**: Autocomplete for cities, zip codes, subdivisions, and elementary schools.
- **Dynamic Map Layers**: Toggle-able flood zone (FEMA NFHL) and school district (City of Austin GIS) overlays on property maps with interactive legends.

## External Dependencies

- **MLS Grid API**: Primary data source for property listings.
- **Repliers API**: Primary data source for active, pending, and closed property listings.
- **PostgreSQL**: Persistent data storage, leveraging Neon serverless driver.
- **Amazon S3**: Storage for media assets.
- **Replit Object Storage**: Used for CMA listing brochure uploads (GCS-backed with presigned URL flow).
- **Mission Control (ReZen) API**: For agent production volume reporting.
- **Follow Up Boss (FUB) API**: For calendar events and lead management.
- **Google Fonts CDN**: Typography (Inter font family).
- **Resend**: Email services for seller update notifications.
- **FEMA NFHL API**: National Flood Hazard Layer data for flood zone overlays.
- **City of Austin ArcGIS**: School district boundary data for map layers.
- **Mapbox GL JS**: Standard mapping library for all application features including CMA presentations, property detail pages, and location-based visualizations.
- **OpenAI API**: For AI Assistant and AI Search Assistant functionalities (GPT-4o).
- **WordPress Integration API**: A dedicated API at `/api/wordpress/*` with CORS enabled for `spyglassrealty.org` provides endpoints for listing properties, retrieving single property details, advanced search, and managing user favorites.