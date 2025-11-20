# MLS Grid IDX/CMA Platform

## Overview

This is a professional real estate IDX (Internet Data Exchange) platform powered by MLS Grid API integration. The platform enables real estate agents to search properties, create Comparative Market Analyses (CMAs), and share insights with clients. It combines property browsing capabilities inspired by leading real estate platforms (Zillow, Redfin, Realtor.com) with productivity-focused workflow tools.

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