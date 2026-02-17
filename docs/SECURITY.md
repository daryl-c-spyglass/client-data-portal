# Client Data Portal — Security Documentation

**Project:** Client Data Portal (Mission Control)
**Last Updated:** 2026-02-17
**Owner:** Ryan Rodenbeck

## Data Classification

| Data Type | Classification | Storage | Notes |
|-----------|---------------|---------|-------|
| Agent emails | Internal | PostgreSQL | Google OAuth, domain-restricted |
| Agent profiles | Internal | PostgreSQL | Name, phone, brokerage info |
| Client emails | Confidential | PostgreSQL | Seller Updates, Saved Searches |
| Property data | Public | Repliers API / PostgreSQL | MLS public data |
| CMA reports | Internal | PostgreSQL | Agent work product |
| CMA brochures | Internal | Replit Object Storage | Uploaded PDFs/images |
| Session tokens | Restricted | JWT httpOnly cookies | 7-day expiry |
| API keys | Restricted | Environment variables | Never logged or exposed |
| Admin activity logs | Internal | PostgreSQL | Role changes, user management |
| Neighborhood boundaries | Public | PostgreSQL | GeoJSON data |

## Authentication & Authorization

### Authentication Method
- **Primary:** Google OAuth 2.0 with domain restriction
- **Token:** JWT (HS256) stored in httpOnly, SameSite cookies
- **Expiry:** 7-day hard expiry, no refresh token
- **Passport.js:** Manages OAuth flow, user serialization

### Role-Based Access Control (4-Tier)

| Role | Level | Capabilities |
|------|-------|-------------|
| Developer | 4 | Full system access, debug endpoints |
| Super Admin | 3 | User management, role changes, activity logs |
| Admin | 2 | Company settings, custom pages, branding |
| Agent | 1 | Property search, CMAs, seller updates |

### Authorization Implementation
- `requireAuth` middleware validates JWT on protected routes
- `requireMinimumRole(role)` enforces minimum role level
- Role hierarchy enforced server-side via utility functions
- Domain restriction on Google OAuth registration

## Threat Model Summary

| Threat | Likelihood | Impact | Mitigation |
|--------|------------|--------|------------|
| Authentication bypass | Unlikely | Severe | JWT verification middleware on all protected routes |
| SQL injection | Rare | Severe | Parameterized queries via Drizzle ORM (no raw SQL) |
| XSS | Possible | Major | React auto-escaping, CSP headers for iframe embedding |
| CSRF | Unlikely | Major | SameSite cookies, httpOnly flag |
| Data exposure via API | Possible | Major | Role-based access control, agent data isolation |
| Debug endpoint abuse | Unlikely | Major | Admin-only auth requirement (secured Feb 2026) |
| API key exposure | Rare | Severe | Environment variables only, no secrets in code or logs |
| Email notification storm | Unlikely | Minor | Scheduler idempotency, daily-only cadence |
| Unauthorized role escalation | Unlikely | Severe | Server-side role validation, admin activity logging |
| AI prompt injection | Possible | Minor | Structured system prompts, output is advisory only |
| Third-party API compromise | Rare | Major | API keys rotatable, no write-back to MLS |

## Security Controls

| Control | Status | Notes |
|---------|--------|-------|
| TLS everywhere | Complete | Replit/Vercel HTTPS enforcement |
| Secrets in environment variables | Complete | No secrets in code |
| JWT httpOnly cookies | Complete | Not accessible to JavaScript |
| SameSite cookie flag | Complete | CSRF protection |
| Input validation (Zod schemas) | Complete | All POST/PUT endpoints validated |
| CSP headers | Complete | Configured for iframe embedding |
| Role-based access control | Complete | 4-tier role system |
| Debug endpoints secured | Complete | Admin auth required (Feb 2026) |
| Admin activity logging | Complete | Role changes, user management logged |
| Google OAuth domain restriction | Complete | Limits registration to authorized domains |
| No PII in server logs | Partial | Log redaction not fully audited |
| Dependency vulnerability scanning | Not Started | Planned |
| Rate limiting on public endpoints | Not Started | Planned |
| API key rotation procedures | Not Started | Planned |

## Security Headers

```
Content-Security-Policy: [configured for iframe embedding]
X-Content-Type-Options: nosniff
X-Frame-Options: [configured per-route]
```

## Incident Response

See [RUNBOOK.md](./RUNBOOK.md) for incident procedures.

## Review Schedule

- Monthly review of security controls
- Update after any security incident
- Update after major feature releases
- Quarterly dependency audit (planned)
