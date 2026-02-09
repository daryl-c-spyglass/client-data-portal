# Security Documentation

## Data Classification

| Level | Data Type | Examples |
|-------|-----------|---------|
| **Public** | MLS property listings | Addresses, prices, photos, listing details |
| **Internal** | User preferences | Saved searches, display settings, CMA drafts |
| **Confidential** | User identity | Email addresses, profile photos, role assignments |
| **Restricted** | Authentication data | Session tokens, OAuth tokens, API keys |

## Authentication

### Google OAuth 2.0
- Provider: Google Identity Platform
- Protocol: OAuth 2.0 Authorization Code flow
- Scope: email, profile
- Domain restriction: @spyglassrealty.com (configurable via ALLOWED_EMAIL_DOMAIN)
- Additional allowed emails configurable via ALLOWED_EMAILS

### Session Management
- Store: PostgreSQL-backed (connect-pg-simple)
- Cookie: httpOnly, secure (production), sameSite: none (for iframe support)
- Expiry: 7 days
- Session secret: Environment variable (SESSION_SECRET)

### Iframe Security
- Popup OAuth flow to bypass iframe redirect restrictions
- postMessage communication with origin validation
- CSP frame-ancestors restricted to known domains

## Authorization

### Role Hierarchy
```
Developer > Super Admin > Admin > Agent
```

| Role | Capabilities |
|------|-------------|
| **Developer** | All permissions, manage super admins, view debug info |
| **Super Admin** | User management, company settings, all agent features |
| **Admin** | Template creation, presentation library, display settings |
| **Agent** | CMA creation, presentations, analytics viewing |

### Enforcement
- Backend middleware: `requireMinimumRole()`, `requirePermission()`
- Frontend guards: `ProtectedRoute` component, `usePermissions()` hook
- User status: `isActive` flag for soft disable without data deletion

## Threat Model Summary

### Attack Surface
- Google OAuth endpoints (rate limited to 30 req/15min)
- REST API endpoints (rate limited to 500 req/15min)
- Static file serving
- Iframe embedding (CSP-protected)

### Mitigations
- Input validation via Zod schemas on API endpoints
- SQL injection prevention via Drizzle ORM parameterized queries
- XSS prevention: React auto-escaping, escapeHtml() for widget innerHTML
- CSRF: sameSite cookie policy
- Open redirect: URL sanitization on OAuth callbacks
- Rate limiting: express-rate-limit on API and auth routes
- Sensitive data redaction in logs

### Known Considerations
- Repliers API key transmitted in request headers (HTTPS only)
- MLS data subject to data sharing agreements
- Profile photos stored via OAuth provider URLs

## PII Handling

### Data Collected
- User email addresses (from Google OAuth)
- User display names and profile photos
- Saved search preferences
- CMA documents and notes

### Data NOT Collected
- Credit card or payment information
- Social Security Numbers
- Personal financial data beyond property interests

### Data Retention
- User accounts: Retained until explicitly deleted by admin
- Sessions: 7-day expiry with automatic cleanup
- Activity logs: Retained indefinitely for audit trail
- CMA documents: Retained until user deletion

### Log Redaction
- Passwords, tokens, secrets, API keys, authorization headers are automatically redacted
- Request IDs tracked for correlation without exposing sensitive data

## Secrets Management

- All secrets stored as environment variables
- No hardcoded secrets in source code
- Production secrets managed via deployment platform (Render/Replit)
- Log redaction applied to all sensitive key patterns

## Incident Response

1. Identify the scope of the incident
2. Rotate any compromised API keys or secrets
3. Review admin activity logs for unauthorized actions
4. Disable affected user accounts if needed
5. Document and review in post-incident analysis
