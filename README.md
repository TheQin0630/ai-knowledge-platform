# AI Knowledge Platform

An enterprise-oriented AI knowledge backend for document ingestion, hybrid retrieval, cited RAG responses, and reproducible evaluation.

The active implementation is a strict TypeScript workspace built with NestJS. The previous FastAPI CMS is preserved in Git under the `legacy-fastapi-baseline` tag and is not deployable.

## Current Status

- NestJS 11 API workspace
- Dependency-free liveness and PostgreSQL/Redis readiness under `/api/v1/health`
- PostgreSQL 17 with pgvector
- Migration-driven TypeORM persistence with a normalized user identity schema
- Least-privilege authentication with Argon2id, purpose-bound JWTs, and revocable Redis sessions
- Redis for authentication sessions, caching, and background job coordination
- Non-root, read-only API container
- Unit, end-to-end, Testcontainers integration, lint, typecheck, and build gates

Document ingestion, retrieval, RAG, and evaluation modules are being delivered incrementally with tests.

The authentication contract and verified failure semantics are documented in [`docs/auth-api-contract.md`](docs/auth-api-contract.md).

## Requirements

- Node.js 24
- pnpm 11.7
- Docker Desktop with Compose

## Local Development

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm test:e2e
pnpm test:integration
pnpm lint
pnpm typecheck
pnpm build
pnpm dev
```

The API listens on `http://localhost:3000` by default.
Integration tests require a running Docker engine and clean up their temporary containers automatically.

## Database Migrations

Set `DATABASE_URL` for the target PostgreSQL database, then inspect and apply migrations explicitly:

```powershell
$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/ai_knowledge'
pnpm migration:show
pnpm migration:run
pnpm migration:revert
```

Application startup never runs migrations and TypeORM schema synchronization is disabled.

## Containers

Create a local environment file and replace every placeholder secret:

```powershell
Copy-Item .env.example .env
docker compose config --quiet
docker compose up --build --wait
```

Do not deploy with values from `.env.example`.

## Repository Layout

```text
apps/api/         NestJS HTTP API
docs/             Specifications, decisions, and evidence
Dockerfile        Multi-stage production image
docker-compose.yml Local PostgreSQL, Redis, and API stack
```

## Authoritative Sources

- NestJS first steps: https://docs.nestjs.com/first-steps
- NestJS validation: https://docs.nestjs.com/techniques/validation
- NestJS authentication: https://docs.nestjs.com/security/authentication
- NestJS SQL integrations: https://docs.nestjs.com/techniques/sql
- TypeORM migrations: https://typeorm.io/docs/advanced-topics/migrations
- Testcontainers for Node.js: https://node.testcontainers.org/
- pnpm workspaces: https://pnpm.io/workspaces
