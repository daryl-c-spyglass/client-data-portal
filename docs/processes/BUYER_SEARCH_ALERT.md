# Process: Buyer Search Alert (Saved Search Notifications)

## Metadata

| Field | Value |
|-------|-------|
| Process Name | Buyer Search Alert |
| Category | Core Business -- Client Communication |
| Owner | Agent (setup) / System (execution) |
| Related Projects | Client Data Portal |
| Version | 1.0 (Planned) |
| Last Updated | 2026-02-17 |
| Status | **Planned -- Not Yet Implemented** |

## Overview

This process will enable agents to set up saved searches for buyer clients, with automatic email notifications when new listings match their criteria. This builds on the existing `saved_searches` database table and Repliers API integration.

## Trigger

**Setup trigger:** Agent creates a saved search with notification enabled for a buyer client.

**Execution trigger:** Scheduled job (planned -- daily or on new listing sync).

## Actors

- **Agent** (Human) -- Creates and manages saved searches
- **Client Data Portal** (System) -- Monitors for new matches and sends alerts
- **Repliers API** (External) -- Provides listing data
- **Resend** (External) -- Email delivery
- **Buyer Client** (Human, recipient) -- Receives new listing alerts

## Pre-Conditions

- Agent is logged in
- Saved search criteria defined (location, price range, beds, baths, etc.)
- Client email address provided
- Notification preferences set

## Planned Steps — Setup Phase

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Create property search with desired criteria | Agent | Manual | Using existing search interface |
| 2 | Save search with "Alert" option enabled | Agent | Manual | Extends current `saved_searches` functionality |
| 3 | Enter buyer client email | Agent | Manual | Recipient for notifications |
| 4 | Set notification frequency | Agent | Manual | Immediately / Daily digest / Weekly |
| 5 | Save configuration | System | Automated | Write to `saved_searches` table with alert settings |

## Planned Steps — Automated Execution Phase

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Scheduled job runs (daily or on sync) | System | Automated | After MLS data sync |
| 2 | Query saved searches with alerts enabled | System | Automated | |
| 3 | For each saved search, check for new listings | System | Automated | Compare against last alert timestamp |
| 4 | If new matches found, generate alert email | System | Automated | Include property photos, details, links |
| 5 | Send email via Resend | System | Automated | |
| 6 | Update last alert timestamp | System | Automated | Prevent duplicate alerts |

## Exception Paths

| Step | Exception | Handling |
|------|-----------|----------|
| 3 | No new matches | Skip notification, no action needed |
| 5 | Email delivery failure | Log error, retry on next cycle |
| 3 | Repliers API unavailable | Use local DB for comparison, skip if insufficient |

## Dependencies on Existing Infrastructure

- `saved_searches` table already exists in schema
- Repliers API search integration already built
- Resend email service already configured
- Seller update scheduler pattern can be reused

## Implementation Notes

This feature would extend the existing saved searches with:
1. New fields: `alertEnabled`, `clientEmail`, `frequency`, `lastAlertAt`
2. A new scheduler (similar to `seller-update-scheduler.ts`)
3. An email template for new listing alerts
4. A deduplication mechanism to prevent re-alerting on seen listings

## Success Metrics

- Alerts sent within specified frequency
- New listings correctly matched to search criteria
- No duplicate alerts for the same listing
- Client engagement with alert emails

## SLA

Planned: Alerts sent within 24 hours of new listing appearing in MLS.
