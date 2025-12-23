# MLS Grid IDX/CMA Platform

## Overview

This project is a professional real estate IDX (Internet Data Exchange) platform integrated with the MLS Grid API. Its primary purpose is to empower real estate agents with tools for property searching, generating Comparative Market Analyses (CMAs), and sharing market insights with clients. The platform aims to combine comprehensive property browsing (similar to Zillow or Redfin) with robust, productivity-focused workflow features to streamline real estate operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React and TypeScript, using Vite. It utilizes `shadcn/ui` (New York style variant) based on Radix UI for its component system and Tailwind CSS for styling, incorporating custom design tokens and supporting light/dark modes. State management is handled by TanStack Query with aggressive caching, and Wouter provides lightweight client-side routing. Key pages include Dashboard, Property Search, Property Detail, CMA management, and CMA report generation. The UI incorporates Spyglass Realty branding with an orange primary color scheme.

### Backend Architecture

The backend is developed with Node.js and Express in TypeScript, using an ESM module system. It exposes a RESTful API with type-safe request/response handling. A flexible storage interface supports in-memory, database (PostgreSQL via Drizzle ORM), and hybrid storage solutions. The system includes a built-in rate limiter to comply with MLS Grid API usage policies. A scheduled daily sync updates the property database, with a manual trigger available. The API intelligently routes property searches: active/under_contract listings query the Repliers API, while closed/sold listings query the local PostgreSQL database.

### Database Schema

The platform uses Drizzle ORM with PostgreSQL, adhering to type-safe schema definitions. Core tables include `properties` (RESO Data Dictionary compliant data), `media` (for property images), `saved_searches`, and `cmas`. Zod schemas are used for runtime validation. The design philosophy strictly follows the MLS Grid's RESO Data Dictionary standard. Property search performance is optimized with database-level pagination and trigram indexes.

### UI/UX Decisions

The UI incorporates Spyglass Realty branding with an orange primary color scheme. `shadcn/ui` (New York style variant) based on Radix UI is used for components, prioritizing visual appeal for client engagement and functional efficiency for agents. Styling is managed with Tailwind CSS, incorporating custom design tokens and supporting light/dark modes.

### Technical Implementations

- **Data Sourcing**: Primary property data comes from the Repliers API (active, pending, closed listings) and MLS Grid API for broader data synchronization.
- **Location Data**: Neighborhood information is derived from boundary polygon resolution using lat/lng coordinates, distinct from subdivision data provided by MLS listings.
- **Caching**: In-memory caches are used for frequently accessed data from external APIs (e.g., FUB, ReZen) to reduce load and improve performance.
- **Rate Limiting**: A built-in rate limiter manages external API requests to comply with usage policies.
- **Inventory Service**: Efficient aggregate-based counting using RESO standardStatus (Active, Active Under Contract, Pending, Closed)
  - Uses `resultsPerPage=1` API calls to get accurate counts from response metadata (4 API calls vs hundreds)
  - Samples first page of each status for subtype distribution estimates
  - 5-minute cache TTL to balance freshness with API efficiency
  - Fallback to database for Closed listings when Repliers is unavailable
  - Dashboard shows all 4 RESO statuses separately: Active, Active Under Contract, Pending, Closed
  - Error messages surface when REPLIERS_API_KEY is not configured
- **Property Status Handling**: All user-facing status labels strictly follow the RESO Data Dictionary 4-status hierarchy:
  - **Active**: Properties currently on the market
  - **Active Under Contract**: Properties with accepted offers still showing (abbreviated "AUC" in compact UI contexts like tabs/legends)
  - **Pending**: Properties with accepted offers no longer showing
  - **Closed**: Completed sales (never displayed as "Sold" in UI)
  - Internal variable names may use legacy terms like `soldProperties` but UI labels always use canonical RESO values
  - Helper function `getStandardStatusLabel()` in `shared/statusMapping.ts` provides canonical label mapping
  - "Close Date" and "Close Price" are used instead of "Sold Date" and "Sold Price"
- **Canonical Data Layer**: Unified listings data layer that merges MLS and Repliers feeds with deterministic deduplication
  - **Types**: `shared/canonical-listing.ts` - `CanonicalListing` interface, `DataSource` enum, address normalization helpers
  - **Service**: `server/data/listings/canonical-listing-service.ts` - `CanonicalListingService` with dedupe pipeline
  - **Mapper**: `server/data/listings/repliers-mapper.ts` - Transforms Repliers API data to canonical format with raw field support
  - **Dedupe Priority**: mlsNumber > listingId > addressKey (normalized street+unit+zip) > lat/lng proximity (50m)
  - **Source Priority for Merging**: MLS > REPLIERS > DATABASE
  - **Address Normalization**: Handles street suffix variations (Street→st, Avenue→ave, Lane→ln, etc.)
  - **Debug Endpoints**:
    - `GET /api/debug/listings/sample?count=25&raw=true` - Sample listings with raw fields
    - `GET /api/debug/listings/dedupe-report?size=100` - Dedupe diagnostics
    - `GET /api/debug/listings/canonical?status=Active&city=Austin&limit=50` - Filtered canonical listings

- **AI Assistant**: Conversational property search and CMA intake assistant powered by OpenAI GPT-4o
  - **Provider**: OpenAI Chat Completions API with JSON response mode
  - **Files**: `server/openai-client.ts` (backend), `client/src/components/ChatAssistant.tsx` (frontend)
  - **Voice Input**: Browser Web Speech API (client-side, not Whisper)
  - **Intent Detection**: Automatically detects user intent as `IDX_SEARCH`, `CMA_INTAKE`, or `OTHER`
  - **Capabilities**:
    - Property search criteria extraction with slot-filling conversation
    - CMA intake with guided questions (area → sqft range → year built range → stories)
    - Neighborhood Q&A and real estate guidance
  - **CMA Intake Flow**: Collects criteria conversationally, requires explicit user confirmation via "Create Draft" button before creating
  - **Safety**: Never auto-creates CMAs; requires user confirmation; validates input ranges
  - **Endpoints**: 
    - `POST /api/chat` - Main chat endpoint with intent detection
    - `GET /api/chat/status` - Check if OpenAI is configured
    - `POST /api/cma/draft` - Create CMA draft from AI-collected criteria

- **AI Search Assistant**: "Describe your ideal home" natural language search in Buyer Search
  - **Pipeline**: User Prompt → OpenAI Parser → Apply to Filters UI → Run Search
  - **Backend Routes**:
    - `POST /api/ai/parse-natural-language` - OpenAI-only parser (primary, works without Repliers NLP)
    - `POST /api/repliers/nlp` - Legacy Repliers NLP proxy (requires upgraded subscription)
    - `POST /api/ai/sanitize-repliers-nlp` - OpenAI sanitizer with RESO-compliant validation
  - **Validation Rules** (enforced server-side):
    - Strip `neighborhood` param (we use Subdivision instead) with warning
    - Validate subdivision against known list (case-insensitive exact match only)
    - Normalize status to RESO standardStatus (Active, Active Under Contract, Pending, Closed)
    - Validate property types against expanded RESO list
  - **Frontend**: Text area panel in Buyer Search filters, Apply/Clear buttons, summary display
  - **Error Handling**: Specific error messages for service unavailable, parse failures
  - **Cost Efficiency**: Uses gpt-4o-mini with max_tokens=500 cap
  - **Files**:
    - `server/routes.ts` - OpenAI parser and sanitizer routes
    - `client/src/pages/BuyerSearch.tsx` - UI panel and `handleAiDescribe()` function

- **AI Image Search**: Visual similarity ranking for property listings powered by Repliers AI
  - **Reference**: https://help.repliers.com/en/article/ai-image-search-implementation-guide-mx30ji/
  - **Backend**: `POST /api/repliers/image-search` endpoint with validation, `RepliersClient.imageSearch()` method
  - **Frontend**: `client/src/components/VisualMatchPanel.tsx` - reusable component for Visual Match UI
  - **Integration Points**:
    - **Buyer Search**: Toggle Visual Match to rank results by visual similarity (text descriptions or image URLs)
    - **CMA Builder**: Use Visual Match to find comps with similar visual characteristics
  - **API Format**: POST to `/listings` with `imageSearchItems` in request body
    - Each item has `type` ('text' or 'image'), `value`/`url`, and optional `boost` (default 1)
    - Score returned per listing is 0-1.0 per item (3 items = max score of 3.0)
  - **Match Tiers**: High (≥70% of max score), Medium (≥40%), Low (<40%)
  - **Preset Chips**: Quick-add options like "Modern Kitchen", "Open Floor Plan", "Pool & Backyard"
  - **Validation**: Max 10 items, URLs must be http/https, boost must be numeric
  - **Files**:
    - `server/repliers-client.ts` - `imageSearch()` method and types
    - `server/routes.ts` - `POST /api/repliers/image-search` endpoint
    - `client/src/components/VisualMatchPanel.tsx` - UI component
    - `client/src/pages/BuyerSearch.tsx` - Integration in Buyer Search filters
    - `client/src/components/CMABuilder.tsx` - Integration in CMA comp search

### Feature Specifications

- **IDX Platform**: Comprehensive property browsing, search, and filtering capabilities.
- **CMA Generation**: Tools for creating Comparative Market Analyses, including detailed reports with market insights, property comparisons, and mapping.
- **Agent Productivity Tools**: Integration with Mission Control (ReZen) for production volume reporting and Follow Up Boss (FUB) for calendar events and lead management.
- **Seller Updates**: Functionality to generate and preview seller update reports.
- **Settings Page**: Centralized management for agent profile, data sync, display preferences, embed codes, and lead capture configuration.
- **Market Insights**: Year-over-Year price comparisons and neighborhood-level market statistics.
- **Property Detail Page**: Enhanced property details with neighborhood reviews, boundary maps, and consistent data display.
- **Search Enhancements**: Autocomplete for cities, zip codes, subdivisions, elementary schools, and separate filters for subdivisions in CMA and buyer searches.
- **Dev Tools**: Status Inspector component (`StatusInspectorToggle`) available on Properties page in development mode for debugging MLS parity issues. Shows standardStatus, legacy status fields, raw API values, and property type fields per listing.
- **Property Type Filtering**: Post-fetch filtering using `shared/propertyTypeGuard.ts` to handle Repliers API limitations
  - **Problem**: Repliers API 'class' parameter only supports broad categories (residential, condo, commercial); 'residential' includes Land/Lots
  - **Solution**: `filterByPropertySubtype()` applies regex-based filtering after API fetch
  - **Single Family Logic**: Requires explicit markers ("single family", "sfr", "detached") AND excludes other types
  - **Exclusion Patterns** (regex word boundaries to avoid false negatives):
    - `/\bcondo(minium)?\b/` - Condo
    - `/\btownhou?se?\b/` or `/\btownhome\b/` - Townhouse
    - `/\bmulti[- ]?family\b/` - Multi-Family (NOT multi-level, multi-story)
    - `/\b(duplex|triplex|fourplex|quadplex)\b/` - Plexes
    - `/\b(manufactured|mobile|modular)\s*(home|house)?\b/` - Manufactured/Mobile
  - **Land Detection**: `isLandOrLot()` checks for LAND_INDICATORS: land, lot, acreage, unimproved, vacant
  - **Applied In**: `/api/search`, `/api/properties/search`, `/api/properties/search/polygon`

## External Dependencies

- **MLS Grid API**: Primary data source for property listings.
- **Repliers API**: Primary data source for active, pending, and closed property listings.
- **PostgreSQL**: Persistent data storage, leveraging Neon serverless driver for production.
- **Amazon S3**: Storage for media assets (images, documents).
- **Mission Control (ReZen) API**: For agent production volume reporting.
  - Mock endpoint: `GET /api/rezen/mock/production?agentId=...` for UI testing without live API
- **Follow Up Boss (FUB) API**: For calendar events and lead management.
  - Uses HTTP Basic Auth: username = API key, password = empty
  - Calendar uses `/appointments` endpoint (returns FUB-created events only, not Google Calendar sync)
  - Falls back to `/tasks` endpoint (uses `assignedUserId`, `dueStart`, `dueEnd` params)
  - Note: Appointments may return empty even if users have Google Calendar events - results are restricted to events created in FUB, owned by the API key user, with calendar sharing enabled
  - API endpoints: `/api/fub/calendar`, `/api/fub/leads`, `/api/fub/users`, `/api/fub/status`
- **`connect-pg-simple`**: PostgreSQL-backed session management.
- **Google Fonts CDN**: Typography (Inter font family).
- **Recharts**: Charting and data visualization.
- **SendGrid**: Email services (e.g., seller updates).