# ADR-002: Use Google OAuth for Authentication

## Status
Accepted

## Date
2026-01-01

## Context
The platform is exclusively for Spyglass Realty team members. Authentication needs to be secure, easy to use, and restrict access to authorized personnel only.

## Decision
Use Google OAuth 2.0 via Passport.js with domain restriction to @spyglassrealty.com. Support popup-based OAuth flow for iframe embedding scenarios.

## Alternatives Considered
- **Email/Password**: Higher maintenance burden, password management complexity
- **Auth0/Clerk**: Additional cost and dependency for a small team
- **SAML/SSO**: Over-engineered for current team size

## Consequences
- Zero password management burden for users and admins
- Domain restriction ensures only team members can access
- Google manages account security (2FA, recovery)
- Popup OAuth flow required for iframe embedding (Google blocks in-iframe redirects)
- Dependency on Google Identity Platform availability
- Additional emails can be allowed via ALLOWED_EMAILS configuration

## Rollback Plan
Local authentication (email/password via passport-local) is already implemented as a fallback strategy in the codebase.
