# Runtime Baseline - 2026-07-10

## Environment

- Windows host with Docker Desktop 29.6.1
- Node.js 24.14.0
- pnpm 11.7.0
- NestJS core resolved by the lockfile
- pgvector/pgvector 0.8.5-pg17-bookworm
- Redis 8.4.4-alpine

## Quality Gates

Verified commands:

```text
pnpm test       -> 1 suite, 1 test passed
pnpm test:e2e   -> 1 suite, 1 test passed
pnpm lint       -> 0 errors, 0 warnings
pnpm typecheck  -> passed
pnpm build      -> passed
```

The first E2E attempt returned 404 because test bootstrap bypassed the global API prefix. Production and test setup now share `configureApp()` and the repeated run passed in approximately two seconds.

## Image Verification

- Multi-stage build completed with `node:24.14.0-bookworm-slim`.
- Final image process UID: 1000 (`node`).
- Legacy Python application directory absent from the image.
- Health endpoint succeeded with a read-only root filesystem and `/tmp` tmpfs.
- Docker build context after `.dockerignore`: approximately 525 KB.

## Compose Verification

Services:

- API: healthy, host test port 18002
- PostgreSQL/pgvector: healthy, host test port 15432
- Redis: healthy, host test port 16379

Runtime checks:

- `GET /api/v1/health/live` returned 200 and `{"status":"ok"}`.
- `CREATE EXTENSION vector` succeeded.
- Installed pgvector extension version reported `0.8.5`.
- Authenticated Redis `PING` returned `PONG`.
- API inspection reported user `node`, read-only root filesystem, `cap_drop=["ALL"]`, and `no-new-privileges:true`.

## Failures Found During Verification

1. Docker build initially copied the entire API directory over pnpm workspace links, removing access to Nest CLI. The build now copies only source and build configuration after dependency installation.
2. Redis initially received the literal string `${REDIS_PASSWORD}` because exec-form Compose commands do not expand environment variables. The command now executes through `sh -c`, and Redis health passes.

## Known Gaps

- PostgreSQL is connected through TypeORM and covered by readiness; Redis is not yet connected or included in readiness.
- Liveness intentionally remains independent of PostgreSQL and Redis.
- Authentication, document ingestion, retrieval, model calls, and AI evaluation are not implemented.
- No CI provider run exists yet.
