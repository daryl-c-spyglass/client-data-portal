# ADR-001: Use PostgreSQL for Data Persistence

## Status
Accepted

## Date
2026-01-01

## Context
The Client Data Portal needs persistent storage for user accounts, CMA documents, saved searches, activity logs, and session management. The system also needs to store synced MLS property data from external APIs.

## Decision
Use PostgreSQL (Neon Serverless) as the primary database, with Drizzle ORM for type-safe schema management and migrations.

## Alternatives Considered
- **SQLite**: Simpler but lacks concurrent access support needed for production
- **MongoDB**: Flexible schema but adds complexity for relational data (users, roles, CMAs)
- **In-memory only**: Not suitable for production persistence

## Consequences
- Reliable ACID-compliant storage for all application data
- Neon serverless provides auto-scaling and built-in backups
- Drizzle ORM provides type-safe queries and migration management
- PostgreSQL session store (connect-pg-simple) for production session management
- SSL configuration needed for production connections

## Rollback Plan
Data can be exported via pg_dump. The application includes a MemStorage fallback for development without a database.
