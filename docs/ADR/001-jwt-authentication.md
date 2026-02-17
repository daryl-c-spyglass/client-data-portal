# ADR-001: JWT Authentication for Serverless Deployment

## Status
Accepted

## Date
2026-02-13

## Context
Session-based authentication using express-session and PostgreSQL session store was incompatible with Vercel serverless deployment. Cold starts and stateless functions couldn't reliably maintain session state. The application needed a stateless authentication mechanism that works across serverless function invocations.

## Decision
Replace session-based auth with JWT tokens stored in httpOnly cookies. Tokens are signed with HS256 algorithm using `SESSION_SECRET` and have a 7-day expiry. Google OAuth flow still uses Passport.js, but the resulting session is immediately converted to a JWT cookie via `setJWTCookie()`.

## Alternatives Considered
1. **Keep sessions with external Redis** -- Added infrastructure complexity and cost for a low-traffic application
2. **Auth0/Clerk managed auth** -- Vendor lock-in, significant migration effort, added cost
3. **JWT in localStorage** -- XSS vulnerability, tokens accessible to JavaScript
4. **Short-lived JWT + refresh tokens** -- Added complexity; 7-day expiry acceptable for internal tool

## Consequences
- Stateless auth works reliably across serverless function invocations
- Token contains user info (no database lookup required per request)
- Logout is client-side only (cookie clearing); no server-side token invalidation
- Token refresh not implemented; users re-authenticate every 7 days
- Session still used transiently during OAuth flow (returnTo URL, popup flag)

## Rollback Plan
Revert to session-based auth if migrating to always-on hosting (e.g., Render, Railway). Would require re-adding express-session with PostgreSQL session store.
