# ADR-004: Workspace Authorization and Knowledge Workbench

## Status

Accepted

## Date

2026-07-13

## Context

The authenticated application needs its first business boundary before document
ingestion is introduced. Users can belong to multiple organizations, while
knowledge bases and future documents must never leak across those boundaries.
The browser also needs a durable selected-Workspace URL without persisting the
access token.

## Decision

- Keep platform `UserRole` and Workspace membership roles independent.
- Use `owner`, `admin`, and `member` membership roles. A Workspace creator is
  inserted as its owner in the same database transaction.
- Do not create a personal Workspace during registration. The authenticated
  empty state explicitly guides the user through first creation.
- Resolve every knowledge-base operation through a Workspace membership. Hide
  non-member Workspaces behind the same 404 contract as absent Workspaces.
- Permit knowledge-base creation to owners and admins; members are read-only.
- Enforce case-insensitive knowledge-base name uniqueness per Workspace in
  PostgreSQL, not only in application code.
- Lock the membership row during knowledge-base creation to keep authorization
  and the write in one transaction boundary.
- Use React Router for the selected Workspace URL and TanStack Query keys scoped
  by Workspace ID. Keep the existing access token exclusively in React memory.
- Treat a protected business API 401 as session expiry and return to the login
  screen. Render 429, dependency/network failure, loading, empty, and mutation
  conflict states separately.

## Consequences

- Platform administrators do not automatically gain tenant access; membership
  remains the tenant boundary.
- Removing a Workspace cascades memberships and knowledge bases, while deleting
  a creator identity remains restricted by foreign keys.
- Member invitation, removal, role editing, and ownership transfer are supported
  by the data model but intentionally have no user interface in this slice.
- Query cache entries cannot be reused between knowledge bases from different
  Workspaces because the Workspace ID is part of every relevant query key.
- The browser route can be refreshed or shared without storing credentials or
  selected tenant state in local storage.

## Alternatives Considered

### Reuse the platform administrator role inside each Workspace

Rejected because a deployment operator and a tenant administrator are different
security principals. Combining them would create an undocumented cross-tenant
bypass.

### Store `workspaceId` on the user

Rejected because it prevents legitimate multi-Workspace membership and makes
role history and future invitation flows harder to represent.

### Keep the selected Workspace only in component state

Rejected because reloads and deep links would lose context. A URL parameter is
durable without becoming a credential or hidden source of authorization.

