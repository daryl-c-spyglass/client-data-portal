# Process: User Onboarding

## Metadata

| Field | Value |
|-------|-------|
| Process Name | User Onboarding |
| Category | Administration |
| Owner | Super Admin (Human) / System |
| Related Projects | Client Data Portal |
| Version | 1.0 |
| Last Updated | 2026-02-17 |

## Trigger

A new agent joins Spyglass Realty and needs access to the Client Data Portal.

## Actors

- **Super Admin** (Human) -- Invites and manages user accounts
- **New Agent** (Human) -- Receives invitation and logs in
- **Client Data Portal** (System) -- Manages registration and access
- **Google OAuth** (External) -- Authentication provider

## Pre-Conditions

- Super Admin is logged in with super_admin role
- New agent has a Google account (preferably on the authorized domain)
- Agent's email is known

## Steps

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Navigate to Admin > User Management | Super Admin | Manual | Requires super_admin role |
| 2 | Click "Invite User" | Super Admin | Manual | |
| 3 | Enter agent's email address | Super Admin | Manual | Must match Google account |
| 4 | Select initial role (Agent) | Super Admin | Manual | Default: Agent |
| 5 | Send invitation | System | Automated | `POST /api/admin/users/invite` |
| 6 | Agent receives invitation | New Agent | Manual | Via email or direct link |
| 7 | Agent visits portal URL | New Agent | Manual | Production or Replit URL |
| 8 | Agent clicks "Sign in with Google" | New Agent | Manual | Google OAuth flow |
| 9 | System validates Google account | System | Automated | Domain restriction check |
| 10 | System creates user record | System | Automated | Writes to `users` table with assigned role |
| 11 | Agent lands on dashboard | New Agent | Manual | First-time user experience |
| 12 | Agent sets up profile | New Agent | Manual | Optional -- name, phone, photo via Settings |

## Alternative Path: Domain-Restricted Auto-Registration

If the agent's email is on the allowed domain (`ALLOWED_EMAIL_DOMAIN`):

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Agent visits portal URL | New Agent | Manual | |
| 2 | Agent clicks "Sign in with Google" | New Agent | Manual | |
| 3 | System validates domain | System | Automated | Checks against `ALLOWED_EMAIL_DOMAIN` |
| 4 | System creates user with default Agent role | System | Automated | Auto-registration |
| 5 | Super Admin can adjust role later | Super Admin | Manual | If needed |

## Alternative Path: Explicit Email Allowlist

If the agent's email is in the `ALLOWED_EMAILS` list:

| # | Step | Actor | Type | Notes |
|---|------|-------|------|-------|
| 1 | Super Admin adds email to `ALLOWED_EMAILS` env var | Super Admin | Manual | Or invite via admin panel |
| 2-5 | Same as domain-restricted flow | | | |

## Exception Paths

| Step | Exception | Handling |
|------|-----------|----------|
| 9 | Email not on allowed domain or list | Registration denied, error message shown |
| 9 | Google OAuth error | Retry login, check Google account status |
| 10 | User already exists | Login to existing account, no duplicate created |
| 4 | Wrong role assigned | Super Admin can change role via User Management |

## Post-Onboarding

After successful onboarding, the agent can:
- Search properties via the IDX interface
- Create CMAs for client presentations
- Set up Seller Updates for client properties
- Use the AI Assistant for property analysis
- Access Follow Up Boss integration (if FUB account linked)

## Role Changes

| Action | Who Can Do It | Endpoint |
|--------|--------------|----------|
| Change user role | Super Admin | `PUT /api/admin/users/:id/role` |
| Enable/disable account | Super Admin | `PUT /api/admin/users/:id/status` |
| Delete account | Super Admin | `DELETE /api/admin/users/:id` |

All role changes are logged in `admin_activity_logs`.

## Outputs

- New user record in `users` table
- Admin activity log entry
- Agent access to platform features based on role

## Success Metrics

- Agent can log in within 5 minutes of receiving invitation
- Agent can perform first property search within 10 minutes
- No orphaned or duplicate user accounts

## SLA

N/A -- Admin-driven process. Target: same-day access for new agents.
