# Changelog

All notable changes to the Client Data Portal are documented in this file.

## [Unreleased]
### Added
- Environment variable validation at startup (Zod schema)
- Structured logging with sensitive data redaction
- Request ID tracking (x-request-id header)
- Rate limiting on API and auth endpoints
- Enhanced health check with database and service status
- Graceful shutdown handling (SIGTERM/SIGINT)
- Enterprise documentation (README, ARCHITECTURE, SECURITY, RUNBOOK, ADRs)

### Changed
- Improved error handling with structured error responses
- Database connection pool with configurable timeouts

## [1.0.0] - 2026-02-06
### Added
- Property search and filtering with Repliers API integration
- CMA Builder with adjustable comparables and AI cover letters
- Presentation Builder with PDF export and Mapbox maps
- 4-tier role-based access control (Developer, Super Admin, Admin, Agent)
- Google OAuth authentication restricted to @spyglassrealty.com
- Follow Up Boss integration for calendar and leads
- ReZen integration for production volume reporting
- AI Assistant with voice input and natural language search
- Interactive Mapbox maps with flood zone and school district overlays
- Seller update email automation via Resend
- Iframe embedding with popup OAuth for Mission Control
- Admin panel with user management and activity logs
- Neighborhood reviews and boundary maps
- Canonical data layer unifying MLS, Repliers, and database sources
- WordPress integration API for property listings
- Favorites widget for external embedding
