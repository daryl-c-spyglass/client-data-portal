# AI Pre-Flight Checklist — AI Assistant

**Feature:** AI Assistant (Chat bubble)
**Component:** `client/src/components/ChatAssistant.tsx`
**Backend:** `server/openai-client.ts`
**Model:** GPT-4o (OpenAI API)
**Date:** 2026-02-17
**Owner:** Daryl C.

## Checklist

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Agent/bot name, purpose, human owner documented | Done | Name: AI Assistant. Purpose: Help agents with property analysis, CMA content, search assistance. Owner: Daryl C. |
| 2 | Project type classified | Done | AI feature within Web App |
| 3 | All read permissions listed | Done | Reads: Current page context, CMA data (if on CMA page), property data, user display name |
| 4 | All write permissions listed | Done | Writes: None directly. Generated content displayed in chat; user must manually copy/use. |
| 5 | External communication capabilities | Done | Sends prompts to OpenAI API only. No email/Slack/social media actions from AI. |
| 6 | Risk assessment completed | Done | See RISK_REGISTER.md R-003, R-005 |
| 7 | Least-privilege credentials | Done | Uses single OPENAI_API_KEY. No admin access. No database write access from AI. |
| 8 | Audit logging for AI actions | Done | All AI endpoints log `[AI Audit]` entries with user ID, prompt length, timestamp |
| 9 | Kill switch exists | Done | `AI_ASSISTANT_ENABLED` env var; set to `false` to disable all AI endpoints with 503 response |
| 10 | Rate limits configured | Done | AI-specific rate limiter: 10 requests/minute on `/api/chat`, `/api/ai/*`, `/api/cmas/draft` |
| 11 | Human-in-the-loop for high-risk | Done | All AI output requires user to manually copy, paste, or otherwise use the content |
| 12 | Hallucination handling defined | Done | AI output is advisory only; property data comes from MLS (authoritative source), not AI |
| 13 | Fallback if offline | Done | `/api/chat/status` endpoint checks availability; error message shown in chat UI |
| 14 | No secrets sent to LLM | Done | See Data Audit below; only public MLS data and user messages sent |
| 15 | Dev/prod separation | Done | Same API key but separate deployment environments |
| 16 | Business process documented | Done | See docs/processes/CMA_CREATION.md (AI-assisted steps) |
| 17 | Change request submitted | N/A | Existing feature; required for future enhancements |
| 18 | Project owner approval | Pending | Requires sign-off from Ryan Rodenbeck |

## AI Implementation Details

### Architecture
```
User Input (ChatAssistant.tsx)
    │
    ▼
POST /api/chat ──▶ openai-client.ts ──▶ OpenAI GPT-4o API
    │                                          │
    ▼                                          ▼
Response displayed                      Generated text
in chat bubble                          (streamed back)
```

### Endpoints Using OpenAI

| Endpoint | Function in openai-client.ts | Purpose |
|----------|------------------------------|---------|
| `POST /api/chat` | `sendChatMessage()` | Conversational AI assistant |
| `POST /api/ai/generate-cover-letter` | `generateCoverLetter()` | CMA cover letter with property context |
| `POST /api/ai/generate-default-cover-letter` | `generateDefaultCoverLetter()` | Default cover letter template |
| `POST /api/ai/parse-natural-language` | `parseNaturalLanguageSearch()` | Convert text to search criteria |
| `POST /api/ai/sanitize-repliers-nlp` | N/A (route handler) | Clean up NLP output for Repliers API |
| `POST /api/cmas/draft` | N/A (uses chat context) | Create CMA draft from AI conversation |

### System Prompts
- Chat assistant receives page context (current URL, page type) to provide relevant help
- Cover letter generation receives property details and comparable data
- NLP search receives the user's natural language query only

## Data Sent to OpenAI — Audit

| Data Type | Classification | Sent to LLM? | Justified? |
|-----------|---------------|--------------|------------|
| User's chat message | Internal | Yes | Yes -- core functionality |
| Current page URL/type | Internal | Yes | Yes -- provides context for relevant help |
| Property addresses | Public | Yes | Yes -- public MLS data needed for analysis |
| Property prices | Public | Yes | Yes -- public MLS data needed for CMA |
| Property details (beds, baths, sqft) | Public | Yes | Yes -- public MLS data |
| CMA comparable data | Public/Internal | Yes | Yes -- needed for cover letter generation |
| User display name | Internal | No | Not sent to OpenAI |
| Client emails | Confidential | No | Never sent -- not included in any prompts |
| Agent personal info (phone, license) | Internal | No | Not included in prompts |
| API keys / secrets | Restricted | No | Never sent -- environment variables only |
| Session tokens | Restricted | No | Never sent -- httpOnly cookies only |

## Implemented Controls

| Item | Priority | Status | Implementation |
|------|----------|--------|----------------|
| Structured audit logging for AI requests | Medium | Done | `[AI Audit]` log entries in all AI route handlers (server/routes.ts) |
| Per-user rate limiting (10 req/min) | Medium | Done | `aiRateLimiter` in server/index.ts, applied to `/api/chat`, `/api/ai/`, `/api/cmas/draft` |
| Feature flag kill switch (`AI_ASSISTANT_ENABLED`) | Medium | Done | Middleware in server/index.ts, returns 503 when set to `false` |
| Token usage monitoring/alerting | Low | Not Started | TBD |

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | Daryl C. | 2026-02-17 | Checklist completed |
| Project Owner | Ryan Rodenbeck | | Pending |
