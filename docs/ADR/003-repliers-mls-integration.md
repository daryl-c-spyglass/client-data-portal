# ADR-003: Repliers API as Primary MLS Data Source

## Status
Accepted

## Date
2026-01-15

## Context
The platform requires access to MLS (Multiple Listing Service) property data for property search, CMA generation, and market analytics. Direct MLS access (RETS/RESO Web API) requires IDX licensing and complex data management. A third-party data provider was needed to simplify integration.

## Decision
Use Repliers API as the primary MLS data source. Repliers handles IDX compliance, data normalization, and provides a REST API for property search. MLS Grid API is retained as a secondary/legacy data source.

### Search Routing Strategy
- **Active / Under Contract listings** -- Query Repliers API in real-time for current data
- **Closed / Sold listings** -- Query local PostgreSQL database (synced daily from Repliers)

This hybrid approach ensures current active listings while maintaining a searchable history of closed sales.

## Alternatives Considered
1. **Direct RETS/RESO Web API** -- Full control but significant compliance and data management burden
2. **MLS Grid only** -- Was the original provider; switched to Repliers for better API design and data quality
3. **Spark API (FBS)** -- Alternative provider; less favorable pricing for our use case
4. **Bridge Interactive** -- Similar to MLS Grid; no significant advantages

## Consequences
- Simplified MLS data access via REST API
- Dependent on Repliers API availability for active listing searches
- Daily sync job required to maintain closed listing data locally
- Data normalization handled by canonical data layer to unify Repliers and MLS Grid formats
- API rate limits must be respected; graceful degradation needed if API is unavailable
- Natural language search powered by Repliers NLP endpoint

## Rollback Plan
Switch to MLS Grid API as primary source (already integrated as secondary). Would require updating search routing logic and potentially adjusting data normalization layer.
