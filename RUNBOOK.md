# Operations Runbook

## Health Check

**Endpoint:** `GET /health`

**Expected Response (healthy):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": "ok",
    "repliers": "configured",
    "google_oauth": "configured"
  }
}
```

**Degraded Response:**
- Status 503 if database check fails
- Individual check values indicate component status

## Startup Verification

On startup, the server validates environment variables and reports feature status:

```
✅ Environment validated successfully
📋 Feature status:
   ✓ Google OAuth
   ✓ Repliers API
   ✓ MLS Grid
   ✗ Follow Up Boss
   ✓ OpenAI
   ✓ Mapbox
```

Features marked with ✗ are disabled but the app will still run.

## Common Issues

### App Won't Start

1. **Check required environment variables:**
   - `DATABASE_URL` - Must be a valid PostgreSQL connection string
   - `SESSION_SECRET` - Must be set (32+ characters recommended)

2. **Check database connectivity:**
   ```bash
   curl http://localhost:5000/health
   ```
   If `checks.database` is `error`, verify the DATABASE_URL and network access.

3. **Check for port conflicts:**
   - Default port is 5000. Override with `PORT` env var.

### Login Not Working

1. **Verify Google OAuth credentials:**
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must be set
   - Check Google Cloud Console for valid OAuth client

2. **Check callback URL:**
   - `GOOGLE_CALLBACK_URL` must match the deployment domain
   - Format: `https://your-domain.com/auth/google/callback`
   - Must be listed in Google Cloud Console → Authorized redirect URIs

3. **Check authorized origins:**
   - Your deployment domain must be in Google Cloud Console → Authorized JavaScript origins

4. **Domain restriction:**
   - Default: Only @spyglassrealty.com emails allowed
   - Override with `ALLOWED_EMAIL_DOMAIN` or `ALLOWED_EMAILS`

### Properties Not Loading

1. **Check Repliers API key:**
   - `REPLIERS_API_KEY` must be valid
   - Health check shows `repliers: "configured"` or `repliers: "not_configured"`

2. **Check Repliers API status:**
   - Verify the API endpoint is accessible
   - Check for rate limiting or quota issues

3. **Check inventory sync:**
   - Sync runs daily at 12:00 AM CST
   - Manual trigger available via admin panel

### Maps Not Showing

1. **Frontend maps:** Check `VITE_MAPBOX_TOKEN` is set and valid
2. **Server geocoding:** Check `MAPBOX_ACCESS_TOKEN` is set
3. **Mapbox account:** Verify token hasn't expired and account is active

### AI Features Not Working

1. Check `OPENAI_API_KEY` is set and valid
2. Verify OpenAI account has available credits
3. Check chat status: `GET /api/chat/status`

### Calendar/Leads Not Loading

1. Check `FUB_API_KEY` is set and valid
2. Verify Follow Up Boss account permissions
3. Check FUB status: `GET /api/fub/status`

## Rate Limiting

- API endpoints: 500 requests per 15 minutes per IP
- Auth endpoints: 30 requests per 15 minutes per IP
- Health check and auth callbacks are exempt

If rate limited, client receives:
```json
{ "error": "Too many requests, please try again later" }
```

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals:
1. Stops accepting new connections
2. Closes database connection pool
3. Forces exit after 10-second timeout

## Rollback Procedure

### Replit (Development)
1. Use Replit's built-in checkpoint system
2. Rollback code, chat, and database together

### Render (Production)
1. Revert to previous Git commit
2. Redeploy from previous version in Render dashboard
3. Database: Restore from Neon point-in-time recovery

## Backup / Restore

### Database
- **Provider**: Neon Serverless PostgreSQL
- **Backups**: Neon provides automatic point-in-time recovery
- **Manual**: `pg_dump` for local backups

### Application
- **Code**: Git version control
- **Configuration**: Environment variables managed in deployment platform
- **Media**: Property photos sourced from MLS (not stored locally)

## Monitoring

### Key Metrics to Watch
- Health check response time (should be < 1s)
- Database connection pool utilization
- Repliers API response times
- Rate limit hit frequency
- Error rate on API endpoints

### Log Analysis
- Request IDs (`x-request-id` header) for request tracing
- Structured JSON logs in production
- Sensitive data automatically redacted from logs
