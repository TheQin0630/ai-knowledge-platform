# Authentication Security Evidence

Date: 2026-07-11
Branch: `refactor/nestjs-ai-platform`

## Verified Scope

- Public registration accepts only normalized email and bounded password input and always creates the `user` role.
- Passwords use Argon2id with 19 MiB memory, 2 iterations, and parallelism 1.
- Access and refresh JWTs use separate secrets, `HS256`, fixed issuer and audience, explicit purpose, UUID identity claims, and required expiry.
- Login stores only a SHA-256 refresh-token digest in a bounded Redis session and returns the raw refresh token only in an HttpOnly, SameSite=Strict cookie.
- Refresh rotation is atomic. Digest replay or user-binding mismatch deletes the affected session.
- Logout is idempotent, revokes the session identified by a valid refresh token, and clears the scoped cookie even if revocation fails.
- Access tokens require an active Redis session with a matching user binding.
- Redis session command failures return a sanitized `503 AUTH_SESSION_UNAVAILABLE`, not an invalid-token 401 or a raw driver error.
- `/health/ready` reports PostgreSQL and Redis independently; `/health/live` performs no dependency query.

## Abuse Cases Covered

- self-assigned registration role and invalid public fields;
- absent-user and wrong-password enumeration;
- forged, expired, wrong-purpose, wrong-algorithm, wrong-issuer, wrong-audience, missing-expiry, and malformed-claim JWTs;
- refresh-token replay and Redis user-binding tampering;
- logout followed by access-token reuse;
- Redis failures during session create, lookup, rotation, cleanup, and revocation;
- production `Secure` Cookie issuance and clearing with matching scope attributes;
- dependency error response redaction.

## Focused Verification

- Health unit tests: 4 passed.
- Health E2E tests: 4 passed.
- Authentication unit tests: 4 suites, 38 passed.
- Authentication E2E contract tests: 12 passed.
- Real Redis session integration tests: 3 passed.
- Lint, TypeScript typecheck, and Nest build passed after the implementation changes.

The repository-wide unit, E2E, integration, audit, and diff gates are run again as the final handoff gate; this file does not claim results that were not observed above.
