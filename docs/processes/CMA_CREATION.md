# Process: CMA Creation

## Metadata

| Field | Value |
|-------|-------|
| Process Name | CMA Creation |
| Category | Core Business |
| Owner | Agent (Human) / System |
| Related Projects | Client Data Portal |
| Version | 1.0 |
| Last Updated | 2026-02-17 |

## Trigger

Agent clicks "Create CMA" from the dashboard or navigates to the CMA creation page.

## Actors

- **Agent** (Human) -- Initiates and reviews CMA
- **Client Data Portal** (System) -- Manages workflow and data
- **Repliers API** (External) -- Provides MLS property data
- **OpenAI GPT-4o** (External, optional) -- Generates cover letter content

## Pre-Conditions

- Agent is logged in via Google OAuth
- Agent has "create CMA" permission (Agent role or higher)
- Repliers API is accessible

## Steps

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Click "Create CMA" | Agent | Manual | From dashboard or navigation |
| 2 | Enter subject property address | Agent | Manual | Address search with autocomplete |
| 3 | Search and validate address | System | Automated | Calls Repliers API for property lookup |
| 4 | Display subject property details | System | Automated | Shows property info, photos, details |
| 5 | Set search criteria for comparables | Agent | Manual | Beds, baths, sqft range, radius, status, date range |
| 6 | Fetch comparable properties | System | Automated | Active/pending from Repliers API; closed from local DB |
| 7 | Review comparable results | Agent | Manual | View list with photos, details, map |
| 8 | Select comparables (3-6 typical) | Agent | Manual | Check/uncheck individual properties |
| 9 | Adjust comparable values | Agent | Manual | Optional -- apply adjustments for differences |
| 10 | Generate cover letter | Agent/AI | AI-Assisted | Optional -- uses OpenAI to draft professional letter |
| 11 | Review and edit cover letter | Agent | Manual | Modify AI-generated content as needed |
| 12 | Configure report sections | Agent | Manual | Choose which sections to include in report |
| 13 | Upload listing brochure | Agent | Manual | Optional -- attach PDF/image brochure |
| 14 | Save CMA | System | Automated | Writes to PostgreSQL database |
| 15 | Share with client | Agent | Manual | Optional -- generate share link or email |

## Exception Paths

| Step | Exception | Handling |
|------|-----------|----------|
| 3 | Address not found in MLS | Show error message, allow manual property entry |
| 6 | No comparables found | Prompt agent to widen search criteria (radius, date range, sqft) |
| 6 | Repliers API unavailable | Show error, allow search of closed listings from local DB only |
| 10 | OpenAI unavailable | Skip AI generation, allow manual cover letter entry |
| 10 | AI generates inaccurate content | Agent reviews and edits before saving (human-in-the-loop) |
| 14 | Database write failure | Show error, retain form data for retry |

## Outputs

- Saved CMA record in PostgreSQL database
- Shareable CMA link (via token-based share endpoint)
- Email share to client (via Resend)
- Report with customizable sections
- Optional PDF brochure attachment

## Data Flow

```
Agent Input ──▶ POST /api/cmas (create)
                    │
                    ├──▶ Repliers API (property lookup)
                    ├──▶ Repliers API (comparable search)
                    ├──▶ Local DB (closed listings)
                    └──▶ OpenAI (cover letter, optional)
                    │
                    ▼
              PostgreSQL (cmas table)
                    │
                    ├──▶ GET /api/cmas/:id (view)
                    ├──▶ POST /api/cmas/:id/share (share link)
                    └──▶ POST /api/cmas/:id/email-share (email)
```

## Success Metrics

- CMA created within 10 minutes
- At least 3 comparables selected
- Client views shared CMA
- Cover letter customized (if AI-assisted)

## SLA

N/A -- Agent-driven process, no time requirement.
