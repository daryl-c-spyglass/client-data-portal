# ADR-002: Vercel for Production Hosting

## Status
Accepted

## Date
2026-02-13

## Context
Needed production hosting for a React frontend + Express.js API application. The platform serves a small team of real estate agents (low-traffic, internal tool). Key requirements: easy deployment, HTTPS, reasonable cost, CDN for static assets.

## Decision
Use Vercel with serverless functions for API routes. Frontend served via Vercel CDN. Development environment hosted on Replit.

## Alternatives Considered
1. **Render** -- Always-on containers with better serverless-compatible support, but higher cost for low-traffic usage
2. **Railway** -- Similar to Render; good developer experience but higher baseline cost
3. **Self-hosted (VPS)** -- Full control but significant maintenance burden for a small team
4. **Replit deployment** -- Good for development but less mature for production hosting at the time

## Consequences
- Fast global CDN for frontend assets
- Cold starts on API routes (mitigated by lightweight handler design)
- Required migration from session-based to JWT auth (see ADR-001)
- Required CSP headers configuration in vercel.json
- Free tier sufficient for current usage levels
- Serverless function timeout limits require careful API design

## Rollback Plan
Migrate to Render or Railway if serverless limitations become blocking (e.g., long-running operations, WebSocket needs). The Express.js backend is portable to any Node.js hosting.
