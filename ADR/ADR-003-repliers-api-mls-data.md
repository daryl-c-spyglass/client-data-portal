# ADR-003: Use Repliers API as Primary MLS Data Source

## Status
Accepted

## Date
2026-01-01

## Context
The platform needs access to real-time MLS property listings (ACTRIS) for property search, CMA generation, and market analytics. Data must include active, under contract, pending, and closed listings.

## Decision
Use Repliers API as the primary MLS data source, with MLS Grid API as a secondary source for inventory synchronization. Implement a canonical data layer to unify data from multiple sources.

## Alternatives Considered
- **MLS Grid only**: Limited query flexibility for real-time search
- **Direct RETS/RESO Web API**: Higher maintenance, complex authentication
- **Bridge Interactive**: Less coverage for ACTRIS market

## Consequences
- Real-time access to ACTRIS MLS data
- API-level filtering for active listings, local filtering for closed
- Daily inventory sync at 12:00 AM CST for dashboard statistics
- Canonical data layer handles deduplication with priority: MLS > Repliers > Database
- Two-query CMA strategy for optimal subdivision matching
- Rate limiting considerations for API calls

## Rollback Plan
MLS Grid serves as a fallback data source. Seed data available for development without API access.
