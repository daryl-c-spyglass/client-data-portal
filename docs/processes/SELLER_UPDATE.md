# Process: Seller Update Emails

## Metadata

| Field | Value |
|-------|-------|
| Process Name | Seller Update Emails |
| Category | Core Business -- Client Communication |
| Owner | Agent (setup) / System (execution) |
| Related Projects | Client Data Portal |
| Version | 1.0 |
| Last Updated | 2026-02-17 |

## Trigger

**Setup trigger:** Agent creates a new seller update configuration for a client property.

**Execution trigger:** Daily scheduled job at 9:00 AM Central Time (node-cron).

## Actors

- **Agent** (Human) -- Creates and configures seller updates
- **Client Data Portal** (System) -- Manages configuration and sends emails
- **Repliers API** (External) -- Provides current market data
- **Resend** (External) -- Email delivery service
- **Client** (Human, recipient) -- Receives market update emails

## Pre-Conditions

- Agent is logged in
- Agent has seller update creation permission
- Client email address is valid
- Resend API key is configured
- Seller update is marked as active

## Steps — Setup Phase

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Navigate to Seller Updates page | Agent | Manual | |
| 2 | Click "Create Seller Update" | Agent | Manual | |
| 3 | Enter subject property address | Agent | Manual | Client's property for market tracking |
| 4 | Enter client email(s) | Agent | Manual | One or more recipient emails |
| 5 | Configure update parameters | Agent | Manual | Search radius, property type, price range |
| 6 | Preview email template | Agent | Manual | Optional -- view how email will appear |
| 7 | Send test email | Agent | Manual | Optional -- `POST /api/seller-updates/:id/send-test` |
| 8 | Activate seller update | Agent | Manual | Toggle active status |
| 9 | Save configuration | System | Automated | Writes to `seller_updates` table |

## Steps — Automated Execution Phase

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Cron job triggers at 9:00 AM CT | System | Automated | `seller-update-scheduler.ts` |
| 2 | Query all active seller updates | System | Automated | Filter by `isActive = true` |
| 3 | For each active update, fetch market data | System | Automated | Query Repliers API for comparable activity |
| 4 | Generate email content | System | Automated | Populate template with market data |
| 5 | Send email via Resend | System | Automated | Using `FROM_EMAIL` and `FROM_NAME` |
| 6 | Record send in history | System | Automated | Write to `seller_update_send_history` table |
| 7 | Log completion | System | Automated | Server logs |

## Exception Paths

| Step | Exception | Handling |
|------|-----------|----------|
| Exec-3 | Repliers API unavailable | Skip this update, log error, retry next day |
| Exec-5 | Resend API error | Log error, record failure in send history |
| Exec-5 | Invalid recipient email | Log bounce, continue with other updates |
| Exec-1 | Scheduler not running | Manual trigger available via `POST /api/sync` |

## Outputs

- Email delivered to client with market update
- Send history recorded in `seller_update_send_history` table
- Server logs for monitoring

## Data Flow

```
Daily Cron (9 AM CT)
    │
    ▼
Query seller_updates (isActive = true)
    │
    ▼
For each update:
    ├──▶ Repliers API (market data)
    ├──▶ Generate email content
    ├──▶ Resend API (send email)
    └──▶ seller_update_send_history (record)
```

## Success Metrics

- Emails delivered daily at expected time
- No duplicate sends (idempotency via send history)
- Client engagement (email opens, link clicks -- tracked by Resend)

## SLA

- Emails sent within 1 hour of scheduled time (9:00-10:00 AM CT)
- 99% delivery rate (dependent on Resend SLA)
