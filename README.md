# Spyglass Realty Client Data Portal (Mission Control)

A professional real estate platform for Spyglass Realty agents, providing property search, Comparative Market Analysis (CMA) generation, and team productivity tools. Integrates with MLS data sources, Follow Up Boss, and AI-powered features.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see Environment Variables below)

# Run in development mode
npm run dev
```

The app starts on `http://localhost:5000`.

## Features

- **Property Search & Filtering**: IDX platform with active, pending, and closed listings
- **CMA Builder**: Professional Comparative Market Analysis with adjustable comparables
- **Presentation Builder**: Export-ready CMA presentations with branding
- **Interactive Maps**: Mapbox-powered maps with flood zone and school district overlays
- **AI Assistant**: Natural language property search and CMA intake (GPT-4o)
- **Calendar & Leads**: Follow Up Boss integration for agent productivity
- **Role-Based Access**: 4-tier hierarchy (Developer > Super Admin > Admin > Agent)
- **Iframe Embedding**: Popup OAuth for embedding in Mission Control / Agent Hub

## Architecture

- **Frontend**: React + TypeScript + Vite + shadcn/ui + Tailwind CSS
- **Backend**: Express.js + TypeScript (ESM)
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with Zod validation

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design.

## Environment Variables

### Required (Production)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session encryption key (32+ chars) |
| `NODE_ENV` | Set to `production` |

### Strongly Recommended

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID (login disabled without) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (login disabled without) |
| `GOOGLE_CALLBACK_URL` | Full OAuth callback URL for production domain |
| `REPLIERS_API_KEY` | Repliers MLS API key (property search disabled without) |

### Optional

| Variable | Description |
|----------|-------------|
| `VITE_MAPBOX_TOKEN` | Mapbox GL JS token (frontend maps) |
| `MAPBOX_ACCESS_TOKEN` | Mapbox token (server geocoding) |
| `OPENAI_API_KEY` | OpenAI API key (AI features) |
| `FUB_API_KEY` | Follow Up Boss API key |
| `REZEN_API_KEY` | ReZen/Mission Control API key |
| `MLSGRID_API_URL` | MLS Grid API URL |
| `MLS_GRID_BBO` | MLS Grid BBO token |
| `MLS_GRID_VOW` | MLS Grid VOW token |
| `ALLOWED_EMAIL_DOMAIN` | OAuth domain restriction (default: spyglassrealty.com) |
| `HOMEREVIEW_API_URL` | HomeReview API URL |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) |

## Testing

```bash
# Health check
curl http://localhost:5000/health
```

## Deployment

See [RUNBOOK.md](RUNBOOK.md) for deployment procedures and troubleshooting.

### Production Deployment (Render)

1. Set all required environment variables
2. Add `GOOGLE_CALLBACK_URL` for production domain
3. Add production redirect URI in Google Cloud Console
4. Deploy via Git push or Render dashboard

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and data flow
- [SECURITY.md](SECURITY.md) - Security policies and data classification
- [RUNBOOK.md](RUNBOOK.md) - Operations guide and troubleshooting
- [CHANGELOG.md](CHANGELOG.md) - Version history
- [ADR/](ADR/) - Architecture Decision Records

## Team

- Spyglass Realty Engineering Team
- Contact: engineering@spyglassrealty.com
