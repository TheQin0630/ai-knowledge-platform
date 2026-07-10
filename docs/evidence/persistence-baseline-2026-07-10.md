# Persistence Baseline - 2026-07-10

## Scope

- TypeORM 0.3.30 and PostgreSQL driver 8.22.0
- PostgreSQL 17 with pgvector 0.8.5
- Initial user identity table and `user`/`admin` role enum
- Explicit migration commands with automatic synchronization disabled
- Testcontainers PostgreSQL integration test

Authentication endpoints, sessions, password hashing, and authorization guards are not part of this baseline.

## Migration Lifecycle

The integration test starts an isolated `pgvector/pgvector:0.8.5-pg17-bookworm` container and verifies:

1. one migration applies to an empty database;
2. pgvector 0.8.5 is enabled without implicit UUID extensions;
3. generated UUIDs, timestamps, and the least-privileged `user` role work;
4. ORM writes normalize email addresses;
5. the database rejects unnormalized, duplicate, and invalid-role writes;
6. password hashes are excluded from ordinary entity queries;
7. rollback removes the user table and role enum while retaining the shared vector extension;
8. the migration applies again after rollback.

The separate CLI check passed this sequence against a disposable database:

```text
migration:show -> pending
migration:run -> applied
migration:show -> applied
migration:revert -> reverted
migration:show -> pending
migration:run -> applied again
```

All temporary verification containers were removed after execution.

## Quality Gates

```text
pnpm test             -> 2 suites, 6 tests passed
pnpm test:e2e         -> 1 suite, 1 test passed
pnpm test:integration -> 1 suite, 1 test passed
pnpm lint             -> 0 errors, 0 warnings
pnpm typecheck        -> passed
pnpm build            -> passed
pnpm audit            -> no known vulnerabilities
pnpm install --frozen-lockfile -> passed
```

## Defects Prevented

- A regression test caught TypeORM implicitly creating `uuid-ossp`; UUID generation now uses PostgreSQL 17's built-in `gen_random_uuid()` without hidden extensions.
- The database now enforces normalized email storage even when a write bypasses the ORM.
- The pnpm build-script allowlist explicitly rejects optional Testcontainers transitive build scripts that are unnecessary for local Docker connections.

## Remaining Work

- Connect NestJS to the data source through `TypeOrmModule.forRootAsync`.
- Add dependency-aware readiness without coupling it to liveness.
- Implement registration, Argon2id password hashing, sessions, JWT purpose checks, RBAC, and abuse-case tests.
