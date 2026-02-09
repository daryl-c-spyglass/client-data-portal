# Client Data Portal Architecture

## Context Diagram

### Users
- **Agents**: Property search, CMA creation, client presentations
- **Admins**: Template management, display settings, user oversight
- **Super Admins**: Full platform access, user management, company settings
- **Developers**: System configuration, debug access, role management

### External Systems
- **Repliers API**: Primary MLS data source (ACTRIS) for active, pending, and closed listings
- **MLS Grid API**: Secondary MLS data source for inventory synchronization
- **Google OAuth**: Team authentication restricted to @spyglassrealty.com
- **Follow Up Boss (FUB)**: CRM integration for calendar events and lead management
- **ReZen (Mission Control)**: Agent production volume reporting
- **Mapbox**: Interactive maps, geocoding, static map generation
- **OpenAI (GPT-4o)**: AI assistant for property search and CMA intake
- **Resend**: Transactional email for seller updates

## Container Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Client Browser                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  React + Vite + shadcn/ui + Tailwind CSS            │ │
│  │  - Property Search & Filtering                       │ │
│  │  - CMA Builder & Presentation Builder                │ │
│  │  - Dashboard & Analytics                             │ │
│  │  - Admin Panel & User Management                     │ │
│  │  - Mapbox GL JS Maps                                 │ │
│  └─────────────────────┬───────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────┘
                          │ REST API
┌─────────────────────────┼───────────────────────────────┐
│  Express.js Backend     │                                │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │  API Layer (server/routes.ts)                        │ │
│  │  - Authentication & Authorization                    │ │
│  │  - Rate Limiting                                     │ │
│  │  - Request ID Tracking                               │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │  Service Layer                                       │ │
│  │  - Repliers Client    - MLS Grid Client              │ │
│  │  - FUB Service        - Mapbox Geocoding             │ │
│  │  - OpenAI Client      - Email Scheduler              │ │
│  ├──────────────────────────────────────────────────────┤ │
│  │  Data Layer (Drizzle ORM)                            │ │
│  │  - DbStorage          - MemStorage (fallback)        │ │
│  └──────────────────────┬──────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────┘
                          │
                ┌─────────┴─────────┐
                │   PostgreSQL      │
                │   (Neon Serverless)│
                └───────────────────┘
```

## Key Components

### Authentication (server/auth.ts)
- Google OAuth 2.0 via Passport.js
- Domain restriction to @spyglassrealty.com (configurable)
- Popup OAuth flow for iframe embedding
- PostgreSQL-backed sessions (connect-pg-simple)
- 4-tier role-based access control

### Property Search (server/repliers-client.ts)
- Active/Under Contract: Repliers API real-time queries
- Closed/Sold: Local database with API backfill
- Canonical data layer unifies MLS + Repliers + Database sources
- Deterministic deduplication with source priority

### CMA Builder
- Two-query strategy: local subdivision + API subdivision filtering
- Adjustable comparables with configurable rates
- AI-powered cover letter generation
- Photo selection via Repliers imageInsights API

### Presentation Builder
- Professional CMA reports with company branding
- Interactive Mapbox maps with static export
- PDF-ready output

### Calendar & Leads (server/followupboss-service.ts)
- Follow Up Boss API integration
- Role-based data access (Super Admin sees all, agents see own)
- Email-based FUB agent matching

## Data Flow

### Property Search Flow
```
User Query → Frontend → Express API → Repliers API (active listings)
                                     → PostgreSQL (closed listings)
                                     → Canonical Merger → Response
```

### Authentication Flow
```
User → Google OAuth → Domain Check → Session Creation → PostgreSQL Session Store
```

### CMA Creation Flow
```
User Input → Subject Property Lookup → Comparable Search (Repliers + DB)
           → Adjustment Calculations → Presentation Builder → PDF Export
```

### Inventory Sync Flow
```
Scheduled (12 AM CST) → Repliers API → Aggregate Counts → Sample Distribution
                       → Subtype Scaling → Cache Update → Dashboard Stats
```

## Database Schema

Core tables (Drizzle ORM):
- `users` - Team accounts with roles, OAuth data, preferences
- `properties` - RESO-compliant property records from MLS sync
- `media` - Property photos and media assets
- `cmas` - Comparative Market Analysis documents with adjustments
- `saved_searches` - User search filters and preferences
- `admin_activity_logs` - Audit trail for admin actions
- `session` - PostgreSQL session store

## Deployment

### Current: Replit
- Development and staging environment
- Auto-restarts on code changes
- Built-in PostgreSQL (Neon)

### Production: Render (planned)
- Express server with static asset serving
- Neon PostgreSQL with SSL
- Environment-based security settings
- Health check at GET /health
