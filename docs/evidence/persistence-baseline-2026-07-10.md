# Persistence Baseline - 2026-07-10

## Scope

- TypeORM 0.3.30 and PostgreSQL driver 8.22.0
- PostgreSQL 17 with pgvector 0.8.5
- Initial user identity table and `user`/`admin` role enum
- Explicit migration commands with automatic synchronization disabled
- NestJS asynchronous TypeORM connection with bounded startup retries
- PostgreSQL-aware readiness with a dependency-independent liveness endpoint
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

## Application Connection and Health

- `DatabaseModule` loads the validated `DATABASE_URL` through `TypeOrmModule.forRootAsync`.
- Nest startup never synchronizes the schema or runs migrations.
- Startup connection retries are limited to three attempts with a one-second delay.
- `GET /api/v1/health/live` performs no dependency query.
- `GET /api/v1/health/ready` executes `SELECT 1` and returns PostgreSQL `up` or a sanitized 503 `down` response.
- E2E tests replace the database module with an explicit fake; they do not silently substitute SQLite.
- The Testcontainers test separately proves that the real Nest database module initializes against PostgreSQL.

## Quality Gates

```text
pnpm test             -> 3 suites, 10 tests passed
pnpm test:e2e         -> 1 suite, 3 tests passed
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

- Add Redis connectivity and include it in readiness without coupling it to liveness.
- Implement registration, Argon2id password hashing, sessions, JWT purpose checks, RBAC, and abuse-case tests.
