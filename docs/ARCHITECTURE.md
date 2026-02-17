# Client Data Portal — Architecture

## Overview

Mission Control / Client Data Portal is Spyglass Realty's centralized platform for IDX property search, Comparative Market Analysis (CMA) generation, seller update automation, and client management. It serves as the primary operational hub for real estate agents.

## Project Classification

| Field | Value |
|-------|-------|
| **Type** | Web App (per EA Guidelines S16.1) |
| **Owner** | Ryan Rodenbeck |
| **Developer** | Daryl C. |
| **Last Updated** | 2026-02-17 |

## C4 Model

### Context Diagram

```
                        ┌─────────────────┐
                        │   Real Estate    │
                        │     Agents       │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Client Data     │
                        │    Portal        │
                        └────────┬─────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │              │         │         │              │
  ┌─────▼─────┐ ┌──────▼────┐ ┌─▼──────┐ ┌▼──────────┐ ┌▼──────────┐
  │ Repliers  │ │ Google    │ │ OpenAI │ │ Follow Up │ │  Resend   │
  │ API (MLS) │ │ OAuth     │ │ GPT-4o │ │ Boss      │ │  (Email)  │
  └───────────┘ └───────────┘ └────────┘ └───────────┘ └───────────┘
```

**Users:**
- **Agents** — Search properties, create CMAs, manage seller updates
- **Admins** — Manage users, company settings, custom report pages
- **Super Admins** — Full access including user role management
- **Developers** — Debug endpoints, system diagnostics

**External Systems:**
- Repliers API — MLS property data (active, pending, closed listings)
- MLS Grid API — Secondary MLS data source
- Google OAuth — Team authentication with domain restriction
- OpenAI GPT-4o — AI assistant, cover letter generation, natural language search
- Follow Up Boss (FUB) — CRM integration for leads and calendar
- Mission Control (ReZen) — Agent production volume reporting
- Resend — Transactional and seller update emails
- Mapbox — Property map visualization
- FEMA NFHL — Flood zone overlay data
- City of Austin ArcGIS — School district boundaries

### Container Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Client Data Portal                              │
├───────────────────┬────────────────────┬────────────────────────────────┤
│   Frontend        │   Backend API      │   Background Jobs             │
│   (React/Vite)    │   (Express.js)     │   (node-cron)                 │
│   TypeScript      │   TypeScript       │                               │
│   Tailwind CSS    │   RESTful API      │   - Seller update emails      │
│   shadcn/ui       │   144 endpoints    │     (daily 9 AM CT)           │
│   TanStack Query  │                    │   - MLS inventory sync        │
│   Wouter          │                    │                               │
│   Mapbox GL       │                    │                               │
└────────┬──────────┴─────────┬──────────┴──────────────┬─────────────────┘
         │                    │                         │
         └───────────────────┬┴─────────────────────────┘
                             │
                 ┌───────────▼───────────┐
                 │   PostgreSQL (Neon)   │
                 │   19 tables           │
                 │   Drizzle ORM         │
                 └───────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18, Vite, TypeScript | User interface |
| UI Components | shadcn/ui (New York), Radix UI | Component library |
| Styling | Tailwind CSS | Utility-first CSS |
| State | TanStack Query v5 | Server state management |
| Routing | Wouter | Client-side routing |
| Maps | Mapbox GL JS | Property visualization |
| Backend | Express.js, TypeScript (ESM) | API server |
| Database | PostgreSQL (Neon serverless) | Data persistence |
| ORM | Drizzle | Type-safe database queries |
| Validation | Zod, drizzle-zod | Runtime type validation |
| Auth | Google OAuth 2.0, JWT (httpOnly cookies) | Authentication |
| Email | Resend | Transactional email |
| MLS Data | Repliers API, MLS Grid API | Property listings |
| AI | OpenAI GPT-4o | Content generation, NLP search |
| CRM | Follow Up Boss API | Lead and calendar management |
| Scheduling | node-cron | Background job scheduling |
| Object Storage | Replit Object Storage | CMA brochure uploads |

### Data Flow

```
Agent Browser ──▶ React Frontend ──▶ Express API
                                        │
                    ┌───────────────────┬┤
                    │                   ││
              ┌─────▼─────┐   ┌────────▼▼────────┐
              │ PostgreSQL │   │  External APIs    │
              │            │   │  - Repliers       │
              │ properties │   │  - OpenAI         │
              │ cmas       │   │  - FUB            │
              │ users      │   │  - Resend         │
              │ ...        │   │  - ReZen          │
              └────────────┘   └──────────────────┘

Property Search Flow:
  Active/Under Contract → Repliers API (real-time)
  Closed/Sold → Local PostgreSQL (synced daily)

CMA Flow:
  Subject Property → Repliers API lookup
  Comparables → Repliers API search + local DB
  Cover Letter → OpenAI GPT-4o generation
  Report → Save to PostgreSQL + optional PDF
```

### API Endpoints Summary

#### Authentication (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/me` | JWT | Current user info |
| GET | `/api/auth/google` | - | Google OAuth initiate |
| GET | `/api/auth/google/callback` | - | Google OAuth callback |
| POST | `/api/auth/logout` | - | Clear JWT cookie |

#### Properties (`/api/properties`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/properties/search` | - | Search active listings via Repliers |
| GET | `/api/properties/sold` | - | Search closed listings from DB |
| GET | `/api/properties/:id` | - | Property detail |
| GET | `/api/properties/:listingId/media` | - | Property media |
| POST | `/api/properties/search/polygon` | - | Polygon-based search |
| GET | `/api/properties/inventory/debug` | Admin | Inventory debug info |

#### CMAs (`/api/cmas`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cmas` | - | List CMAs |
| POST | `/api/cmas` | - | Create CMA |
| GET | `/api/cmas/report-sections` | - | Available report sections |
| POST | `/api/cmas/draft` | - | Create CMA draft from AI |
| GET | `/api/cmas/:id` | - | CMA detail |
| PATCH | `/api/cmas/:id` | - | Update CMA |
| DELETE | `/api/cmas/:id` | - | Delete CMA |
| GET | `/api/cmas/:id/statistics` | - | CMA statistics |
| GET | `/api/cmas/:id/adjustments` | - | CMA adjustments |
| PUT | `/api/cmas/:id/adjustments` | JWT | Update adjustments |
| GET | `/api/cmas/:id/report-config` | JWT | Report configuration |
| PUT | `/api/cmas/:id/report-config` | JWT | Update report config |
| POST | `/api/cmas/:id/share` | - | Create share link |
| DELETE | `/api/cmas/:id/share` | - | Remove share link |
| POST | `/api/cmas/:id/email-share` | - | Email CMA share |
| POST | `/api/cmas/:id/brochure` | JWT | Upload brochure |
| GET | `/api/cmas/:id/brochure` | - | Get brochure |
| DELETE | `/api/cmas/:id/brochure` | JWT | Delete brochure |

#### AI (`/api/ai`, `/api/chat`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | - | AI assistant chat |
| GET | `/api/chat/status` | - | AI service status |
| POST | `/api/ai/generate-cover-letter` | - | Generate CMA cover letter |
| POST | `/api/ai/generate-default-cover-letter` | - | Default cover letter |
| POST | `/api/ai/parse-natural-language` | - | NLP property search |
| POST | `/api/ai/sanitize-repliers-nlp` | - | Sanitize NLP for Repliers |

#### Seller Updates (`/api/seller-updates`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/seller-updates` | - | List seller updates |
| POST | `/api/seller-updates` | - | Create seller update |
| GET | `/api/seller-updates/:id` | - | Detail |
| PATCH | `/api/seller-updates/:id` | - | Update |
| DELETE | `/api/seller-updates/:id` | - | Delete |
| POST | `/api/seller-updates/:id/send-test` | - | Send test email |
| POST | `/api/seller-updates/:id/toggle-active` | - | Toggle active |
| GET | `/api/seller-updates/:id/preview` | - | Preview email |

#### Admin (`/api/admin`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/users` | Super Admin | List users |
| POST | `/api/admin/users/invite` | Super Admin | Invite user |
| PUT | `/api/admin/users/:id/role` | Super Admin | Change role |
| PUT | `/api/admin/users/:id/status` | Super Admin | Enable/disable |
| DELETE | `/api/admin/users/:id` | Super Admin | Delete user |
| GET | `/api/admin/activity-logs` | Super Admin | Activity logs |
| GET | `/api/admin/company-settings` | JWT | Company settings |
| PUT | `/api/admin/company-settings` | Admin | Update settings |
| GET | `/api/admin/custom-pages` | JWT | Custom pages |
| POST | `/api/admin/custom-pages` | Admin | Create page |
| PUT | `/api/admin/custom-pages/:id` | Admin | Update page |
| DELETE | `/api/admin/custom-pages/:id` | Admin | Delete page |
| GET | `/api/admin/fub/users` | Super Admin | FUB users |

#### Other Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | - | Health check |
| GET | `/api/autocomplete/*` | - | City/zip/school autocomplete (7 endpoints) |
| GET | `/api/dashboard/*` | - | Dashboard analytics (5 endpoints) |
| GET | `/api/stats/*` | - | Statistics (4 endpoints) |
| GET | `/api/fub/*` | Mixed | Follow Up Boss integration (6 endpoints) |
| GET | `/api/rezen/*` | JWT | Mission Control reporting |
| GET | `/api/homereview/*` | - | Neighborhood data (8 endpoints) |
| GET | `/api/wordpress/*` | - | WordPress integration (4 endpoints) |
| POST | `/api/sync` | - | Trigger MLS sync |
| GET | `/api/sync/status` | - | Sync status |
| GET | `/api/debug/*` | Admin | Debug endpoints (3 endpoints) |

### Database Schema Summary

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `properties` | RESO-compliant property listings | Has many `media` |
| `media` | Property photos and media | Belongs to `properties` |
| `users` | Agent/admin accounts | Has many `cmas`, `saved_searches` |
| `admin_activity_logs` | Audit trail for admin actions | References `users` |
| `saved_searches` | Saved search criteria | Belongs to `users` |
| `seller_updates` | Seller market update configurations | Belongs to `users` |
| `seller_update_send_history` | Email send tracking | Belongs to `seller_updates` |
| `cmas` | Comparative Market Analyses | Belongs to `users` |
| `cma_report_configs` | CMA report layout settings | Belongs to `cmas` |
| `cma_report_templates` | Reusable CMA templates | Belongs to `users` |
| `sync_metadata` | MLS sync tracking | - |
| `display_preferences` | UI display settings | Belongs to `users` |
| `lead_gate_settings` | Lead capture configuration | Belongs to `users` |
| `agent_profiles` | Extended agent profile data | Belongs to `users` |
| `company_settings` | Company-wide branding | - |
| `custom_report_pages` | Admin-created report pages | - |
| `wp_favorites` | WordPress user favorites | - |
| `neighborhood_boundaries` | GeoJSON boundary data | - |
