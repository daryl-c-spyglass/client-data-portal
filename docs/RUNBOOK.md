# Client Data Portal — Operations Runbook

## Quick Links

| Resource | URL |
|----------|-----|
| Production | https://client-data-portal-nine.vercel.app |
| Vercel Dashboard | https://vercel.com/ryan-4655s-projects/client-data-portal |
| GitHub Repo | https://github.com/daryl-c-spyglass/client-data-portal |
| Replit (Dev) | Current Replit workspace |

## Health Checks

| Endpoint | Expected | Action if Failed |
|----------|----------|------------------|
| `/` | 200 OK, React app loads | Check deployment logs |
| `/api/health` | 200 OK | Check serverless function / server process |
| `/api/auth/me` | 401 (no cookie) or 200 (authenticated) | Auth system operational |
| `/api/chat/status` | 200 OK with status object | OpenAI connectivity issue |
| `/api/sync/status` | 200 OK with sync info | Database connectivity issue |
| `/api/fub/status` | 200 OK | Follow Up Boss API connectivity |

## Common Incidents

### 1. White Screen / App Not Loading

**Symptoms:** Blank page, console errors, no React rendering
**Causes:** CSP blocking scripts, build failure, serverless timeout, JavaScript error

**Resolution:**
1. Check Vercel deployment logs for build errors
2. Verify CSP headers in vercel.json if applicable
3. Check browser console for JavaScript errors
4. Check for missing environment variables
5. Rollback to previous deployment if needed (see Rollback Procedure)

### 2. Authentication Failures

**Symptoms:** Cannot log in, redirect loops, 401 on all requests
**Causes:** JWT secret mismatch, Google OAuth config change, cookie issues

**Resolution:**
1. Verify `SESSION_SECRET` matches between environments
2. Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in env vars
3. Verify Google OAuth redirect URIs match deployment URL
4. Clear browser cookies and retry
5. Check server logs for JWT verification errors

### 3. MLS Data Not Loading / Property Search Empty

**Symptoms:** Empty property lists, search returns no results, API errors
**Causes:** Repliers API down, rate limits hit, invalid API key, query malformed

**Resolution:**
1. Check Repliers API status / their status page
2. Verify `REPLIERS_API_KEY` is set and valid
3. Check server logs for Repliers API error responses
4. Test with a simple query to isolate the issue
5. If rate-limited, wait and retry after cooldown period

### 4. Seller Update Emails Not Sending

**Symptoms:** Scheduled emails not delivered, no send history entries
**Causes:** Resend API issues, invalid recipient email, template error, scheduler not running

**Resolution:**
1. Check Resend dashboard for delivery failures
2. Verify `RESEND_API_KEY` is set and valid
3. Verify `FROM_EMAIL` and `FROM_NAME` are configured
4. Check seller update `isActive` status in database
5. Check server logs for scheduler execution around 9 AM CT
6. Test with the send-test endpoint: `POST /api/seller-updates/:id/send-test`

### 5. AI Assistant Not Responding

**Symptoms:** Chat returns errors, cover letter generation fails
**Causes:** OpenAI API down, API key invalid, rate limits exceeded

**Resolution:**
1. Check `/api/chat/status` endpoint
2. Verify `OPENAI_API_KEY` is set and valid
3. Check OpenAI status page (status.openai.com)
4. Check server logs for OpenAI API error details
5. AI features are non-critical; app continues without them

### 6. Database Connection Issues

**Symptoms:** 500 errors across multiple endpoints, data not loading
**Causes:** Neon database connection limit, invalid DATABASE_URL, cold start timeout

**Resolution:**
1. Verify `DATABASE_URL` is correctly set
2. Check Neon dashboard for connection pool status
3. Check for connection limit errors in logs
4. Restart the application to reset connection pool

## Rollback Procedure

### Vercel Deployment
1. Go to Vercel Dashboard, then Deployments
2. Find the last working deployment
3. Click "..." then "Promote to Production"
4. Verify the app loads correctly
5. Investigate the failed deployment separately

### Replit Development
1. Use Replit's checkpoint/rollback feature
2. Identify the checkpoint before the breaking change
3. Restore code and optionally database state

## Scheduled Jobs

| Job | Schedule | Purpose | Timezone |
|-----|----------|---------|----------|
| Seller Update Emails | Daily 9:00 AM | Send market updates to active clients | US/Central (CT) |

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL` | PostgreSQL (Neon) connection string | Yes |
| `SESSION_SECRET` | JWT token signing secret | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect URI | Yes |
| `REPLIERS_API_KEY` | Repliers MLS data API key | Yes |
| `OPENAI_API_KEY` | OpenAI GPT-4o API key | Yes (for AI features) |
| `RESEND_API_KEY` | Resend email service API key | Yes (for emails) |
| `MLSGRID_API_TOKEN` | MLS Grid secondary data source | Optional |
| `FUB_API_KEY` | Follow Up Boss CRM API key | Optional |
| `REZEN_API_KEY` | Mission Control (ReZen) API key | Optional |
| `FROM_EMAIL` | Sender email for transactional mail | Yes (for emails) |
| `FROM_NAME` | Sender display name | Yes (for emails) |
| `ALLOWED_EMAIL_DOMAIN` | Google OAuth domain restriction | Optional |
| `ALLOWED_EMAILS` | Explicit allowed email list | Optional |

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Project Owner | Ryan Rodenbeck | Slack: @ryan |
| Developer | Daryl C. | Slack: @daryl |
| AI Collaborator | Clawd | Slack: @clawd |
