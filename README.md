# AI Knowledge Platform

An enterprise-oriented AI knowledge backend for document ingestion, hybrid retrieval, cited RAG responses, and reproducible evaluation.

The active implementation is a strict TypeScript workspace built with NestJS. The previous FastAPI CMS is preserved in Git under the `legacy-fastapi-baseline` tag and is not deployable.

## Current Status

- NestJS 11 API workspace
- Canonical liveness endpoint: `GET /api/v1/health/live`
- PostgreSQL 17 with pgvector
- Redis for caching and background job coordination
- Non-root, read-only API container
- Unit, end-to-end, lint, typecheck, and build gates

Authentication, document ingestion, retrieval, RAG, and evaluation modules are being delivered incrementally with tests.

## Requirements

- Node.js 24
- pnpm 11.7
- Docker Desktop with Compose

## Local Development

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm dev
```

The API listens on `http://localhost:3000` by default.

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
- pnpm workspaces: https://pnpm.io/workspaces
