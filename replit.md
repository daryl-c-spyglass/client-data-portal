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
- **Property Status Handling**: Comprehensive logic for handling various listing statuses (Active, Pending, Closed, Under Contract) from different data sources, including `standardStatus` and `lastStatus` fields.

### Feature Specifications

- **IDX Platform**: Comprehensive property browsing, search, and filtering capabilities.
- **CMA Generation**: Tools for creating Comparative Market Analyses, including detailed reports with market insights, property comparisons, and mapping.
- **Agent Productivity Tools**: Integration with Mission Control (ReZen) for production volume reporting and Follow Up Boss (FUB) for calendar events and lead management.
- **Seller Updates**: Functionality to generate and preview seller update reports.
- **Settings Page**: Centralized management for agent profile, data sync, display preferences, embed codes, and lead capture configuration.
- **Market Insights**: Year-over-Year price comparisons and neighborhood-level market statistics.
- **Property Detail Page**: Enhanced property details with neighborhood reviews, boundary maps, and consistent data display.
- **Search Enhancements**: Autocomplete for cities, zip codes, subdivisions, elementary schools, and separate filters for neighborhoods and subdivisions in CMA and buyer searches.

## External Dependencies

- **MLS Grid API**: Primary data source for property listings.
- **Repliers API**: Primary data source for active, pending, and closed property listings.
- **PostgreSQL**: Persistent data storage, leveraging Neon serverless driver for production.
- **Amazon S3**: Storage for media assets (images, documents).
- **Mission Control (ReZen) API**: For agent production volume reporting.
  - Mock endpoint: `GET /api/rezen/mock/production?agentId=...` for UI testing without live API
- **Follow Up Boss (FUB) API**: For calendar events and lead management.
- **`connect-pg-simple`**: PostgreSQL-backed session management.
- **Google Fonts CDN**: Typography (Inter font family).
- **Recharts**: Charting and data visualization.
- **SendGrid**: Email services (e.g., seller updates).