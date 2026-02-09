# ADR-004: 4-Tier Role-Based Access Control

## Status
Accepted

## Date
2026-01-01

## Context
The platform serves different user types with varying levels of access: regular agents, team admins, and system administrators. Access control must be enforced on both frontend and backend.

## Decision
Implement a 4-tier role hierarchy: Developer > Super Admin > Admin > Agent. Enforce permissions via backend middleware and frontend route guards.

### Role Capabilities
- **Developer**: All permissions, manage super admins, debug access
- **Super Admin**: User management, company settings, view all agents' data
- **Admin**: Template creation, presentation library, display settings
- **Agent**: CMA creation, presentations, analytics (own data only)

## Alternatives Considered
- **2-tier (Admin/User)**: Too simple for the team's operational needs
- **Permission-based (no roles)**: More flexible but harder to manage
- **External RBAC service**: Unnecessary complexity for current scale

## Consequences
- Clear access boundaries between user types
- Backend middleware (`requireMinimumRole`, `requirePermission`) enforces all access
- Frontend `usePermissions()` hook and `ProtectedRoute` for UI guards
- Developer role hardcoded to specific emails for security
- Initial Super Admin assignment for first-time setup
- Soft-disable via `isActive` flag preserves data while blocking access
- Activity logging for all role changes and admin actions

## Rollback Plan
Roles stored in database `users.role` column. Can be reset via direct database update if needed.
