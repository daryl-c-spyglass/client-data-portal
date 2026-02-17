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

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture and technology stack |
| [SECURITY.md](docs/SECURITY.md) | Security controls and data classification |
| [RUNBOOK.md](docs/RUNBOOK.md) | Operations and incident response |
| [RISK_REGISTER.md](docs/RISK_REGISTER.md) | Active risks and mitigations |
| [AI_PREFLIGHT_CHECKLIST.md](docs/AI_PREFLIGHT_CHECKLIST.md) | AI feature compliance checklist |
| [openapi.yaml](docs/openapi.yaml) | API documentation (OpenAPI 3.0) |
| [CHANGELOG.md](docs/CHANGELOG.md) | Version history |
| [ADR/](docs/ADR/) | Architecture Decision Records |
| [processes/](docs/processes/) | Business process documentation |

## Enterprise Architecture Compliance

This project follows Spyglass Enterprise Architecture Guidelines v2.0.

- **Project Type:** Web App (S16.1)
- **Risk Level:** Medium-High (S17)
- **Last Review:** 2026-02-17

## Environments

| Environment | URL |
|-------------|-----|
| Production | https://client-data-portal-nine.vercel.app |
| Development | Replit |

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Project Owner | Ryan Rodenbeck | Slack: @ryan |
| Developer | Daryl C. | Slack: @daryl |
| AI Collaborator | Clawd | Slack: @clawd |
