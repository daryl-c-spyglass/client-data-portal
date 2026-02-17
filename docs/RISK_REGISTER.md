# Client Data Portal — Risk Register

**Project:** Client Data Portal (Mission Control)
**Type:** Web App
**Last Updated:** 2026-02-17
**Owner:** Ryan Rodenbeck

## Risk Scoring Matrix

| Likelihood / Impact | Negligible | Minor | Major | Severe |
|---------------------|------------|-------|-------|--------|
| Almost Certain | Medium | High | Critical | Critical |
| Likely | Low | Medium | High | Critical |
| Possible | Low | Medium | High | High |
| Unlikely | Low | Low | Medium | Medium |
| Rare | Low | Low | Low | Medium |

## Active Risks

| ID | Risk | Category | Likelihood | Impact | Level | Mitigation | Owner |
|----|------|----------|------------|--------|-------|------------|-------|
| R-001 | Authentication bypass allows unauthorized access | Security | Unlikely | Severe | Medium | JWT verification middleware on all protected routes, role checks, domain-restricted OAuth | Dev |
| R-002 | MLS data exposed to unauthorized users | Data | Possible | Major | High | Role-based access, agent can only see own CMAs, admin-only debug endpoints | Dev |
| R-003 | AI generates inaccurate property descriptions or prices | AI-Specific | Likely | Major | High | Human review required before publishing, all AI output is advisory only, disclaimer text | Dev |
| R-004 | Repliers API offline, property search nonfunctional | Integration | Possible | Major | High | Closed listings available from local DB, graceful error messages | Dev |
| R-005 | OpenAI API offline, AI features unavailable | Integration | Possible | Minor | Medium | AI features are non-critical, fallback to manual entry, clear error messages | Dev |
| R-006 | PII (client emails) exposed in logs | Data | Possible | Major | High | Log redaction audit needed, no PII in structured logs | Dev |
| R-007 | Debug endpoints expose internal data | Security | Unlikely | Major | Medium | Secured with admin auth (Feb 2026), 7 endpoints behind `requireMinimumRole("admin")` | Dev |
| R-008 | Email notification storm (duplicate sends) | Operational | Unlikely | Minor | Low | Daily-only scheduler cadence, send history tracking in `seller_update_send_history` table | Dev |
| R-009 | Unauthorized role escalation | Security | Unlikely | Severe | Medium | Server-side role validation, admin activity logging, super_admin-only role changes | Dev |
| R-010 | Database credentials exposed | Security | Rare | Severe | Medium | Environment variables only, no secrets in code, httpOnly cookies | Dev |
| R-011 | Third-party API key compromise | Security | Rare | Major | Low | Keys stored in environment variables, rotatable without code changes | Dev |
| R-012 | MLS data sync failure causes stale closed listings | Operational | Possible | Minor | Medium | Sync status monitoring endpoint, manual sync trigger available | Dev |

## AI-Specific Risk Assessment (Section 17.5)

**AI Feature:** AI Assistant (ChatAssistant.tsx)
**Model:** GPT-4o via OpenAI API

| Question | Answer |
|----------|--------|
| What can it read? | User context (current page), CMA data, property data. Classification: Internal/Public. |
| What can it write? | Generated text responses only. No direct database writes. User must manually copy/use content. |
| What can it send externally? | Sends prompts to OpenAI API. No email/Slack/social media from AI directly. |
| What if it hallucinates? | Could generate inaccurate property info or pricing. Mitigation: All AI output is advisory; user must review before use. |
| What if it goes offline? | AI Assistant shows error message, app continues functioning. All core features work without AI. |
| What if it loops? | Max tokens per request limits response size. No autonomous retry loops. |
| Human owner? | Daryl C. (Developer) |

**AI Endpoints:**
| Endpoint | Purpose | Data Sent | Risk |
|----------|---------|-----------|------|
| `POST /api/chat` | Conversational assistant | Page context, user message, conversation history | Low - public MLS data, no PII |
| `POST /api/ai/generate-cover-letter` | CMA cover letter | Property details, CMA comparables | Low - public MLS data |
| `POST /api/ai/generate-default-cover-letter` | Default cover letter template | Property details | Low - public MLS data |
| `POST /api/ai/parse-natural-language` | NLP property search | User search text | Low - no sensitive data |
| `POST /api/ai/sanitize-repliers-nlp` | Sanitize NLP for Repliers | Search criteria | Low - no sensitive data |
| `POST /api/cmas/draft` | CMA draft from AI criteria | Search criteria from AI chat | Low - public MLS data |

## Mitigation Status

| ID | Mitigation | Status | Notes |
|----|------------|--------|-------|
| R-001 | JWT middleware on protected routes | Complete | All auth routes verified |
| R-002 | Role-based access control | Complete | 4-tier role system active |
| R-003 | Human-in-the-loop for AI output | Complete | All AI output requires manual user action |
| R-004 | Graceful degradation for Repliers | Partial | Error messages shown; local cache for closed listings |
| R-005 | AI fallback messaging | Complete | Error messages shown; kill switch via `AI_ASSISTANT_ENABLED` env var; rate limiting active |
| R-006 | Log redaction audit | Not Started | Needs audit of all console.log/error statements |
| R-007 | Secure debug endpoints | Complete | Admin auth added Feb 2026 |
| R-008 | Email send idempotency | Complete | Send history tracking, daily-only cadence |
| R-009 | Role change audit logging | Complete | Admin activity logs table |
| R-010 | Secrets management | Complete | All secrets in environment variables |
| R-011 | API key rotation procedures | Not Started | Document rotation process |
| R-012 | Sync monitoring | Partial | Status endpoint exists; alerting not configured |
| R-NEW | AI rate limiting | Complete | 10 req/min per IP on all AI endpoints (server/index.ts) |
| R-NEW | AI audit logging | Complete | All AI requests logged with `[AI Audit]` prefix, user ID, timestamp |
| R-NEW | AI kill switch | Complete | `AI_ASSISTANT_ENABLED=false` disables all AI endpoints with 503 |

## Review Schedule

- Monthly review of active risks
- Update after any security incident
- Update after major feature releases
- Quarterly reassessment of risk levels
