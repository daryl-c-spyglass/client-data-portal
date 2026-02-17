# Client Data Portal — Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Enterprise Architecture documentation suite (ARCHITECTURE.md, SECURITY.md, RUNBOOK.md, ADR templates, RISK_REGISTER.md, AI_PREFLIGHT_CHECKLIST.md, business process maps)

## [2026-02-17] — URL Cleanup & Security Hardening

### Changed
- Renamed `/api/cma/draft` to `/api/cmas/draft` for plural consistency
- Renamed `/api/cma/report-sections` to `/api/cmas/report-sections` for plural consistency
- Renamed `/api/media/property/:listingId` to `/api/properties/:listingId/media` for RESTful nesting
- Fixed Express route ordering to prevent `/api/cmas/:id` from capturing named sub-routes

### Security
- Secured 7 debug/test endpoints with admin authentication (`requireAuth` + `requireMinimumRole("admin")`):
  - `/api/properties/inventory/debug`
  - `/api/mlsgrid/test`
  - `/api/repliers/test`
  - `/api/rezen/mock/production`
  - `/api/debug/listings/sample`
  - `/api/debug/listings/dedupe-report`
  - `/api/debug/listings/canonical`

## [2026-02-16] — Branding Update

### Changed
- Updated browser title and meta tags to "Mission Control | Client Data Portal" across all pages
- Updated email templates with consistent branding

## [Prior History]

Key milestones before changelog tracking:
- CMA Presentation Builder with customizable report sections
- AI Assistant with conversational property search
- Seller Update automation with daily scheduled emails
- Google OAuth with domain restriction and 4-tier role system
- Mapbox integration with flood zone and school district overlays
- Follow Up Boss CRM integration
- Mission Control (ReZen) production reporting
- WordPress integration API for external property widgets
- Neighborhood boundary visualization and reviews
- Property search with Repliers API and local database for closed listings
