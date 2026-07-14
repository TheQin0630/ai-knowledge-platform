# AI Knowledge Platform

An enterprise-oriented AI knowledge platform for document ingestion, hybrid retrieval, cited RAG responses, and reproducible evaluation.

The implementation is a strict TypeScript workspace built with NestJS and React.

## Current Status

- NestJS 11 API workspace
- React 19 and Vite web workspace with a responsive authenticated workbench
- Dependency-free liveness and PostgreSQL/Redis readiness under `/api/v1/health`
- PostgreSQL 17 with pgvector
- Migration-driven TypeORM persistence with a normalized user identity schema
- Least-privilege authentication with Argon2id, purpose-bound JWTs, revocable Redis sessions, and distributed login abuse controls
- Workspace-scoped owner/admin/member authorization with tenant-hiding API semantics
- Workspace switching plus knowledge-base list and create flows on desktop and mobile
- Versioned PDF, DOCX, TXT and Markdown ingestion through MinIO/S3 with BullMQ parsing and retry
- Upload progress, parsing status, version detail and retry in the responsive knowledge workbench
- Keyword and pgvector hybrid retrieval with a retrieval debugging workbench
- OpenAI-compatible, prompt-injection-aware RAG answers with server-validated source citations
- Persisted evaluation runs with keyword, citation and grounded-answer metrics for version comparison
- Correlated, structured authentication security events with allowlisted fields
- Redis for authentication sessions, caching, and background job coordination
- Non-root, read-only API container
- Unit, end-to-end, Testcontainers integration, lint, typecheck, and build gates

The planned core product path—authentication, workspaces, ingestion, retrieval, cited RAG and evaluation—is implemented.

The authentication contract and verified failure semantics are documented in [`docs/auth-api-contract.md`](docs/auth-api-contract.md). Workspace roles and endpoints are documented in [`docs/workspace-api-contract.md`](docs/workspace-api-contract.md). Document upload and retry semantics are documented in [`docs/document-ingestion-api-contract.md`](docs/document-ingestion-api-contract.md).

## Requirements

- Node.js 24
- pnpm 11.7
- Docker Desktop with Compose

## Local Development

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm test:web
pnpm test:e2e
pnpm test:integration
pnpm test:web:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm dev
pnpm dev:web
```

The API listens on `http://localhost:3000` by default. The web application listens on `http://127.0.0.1:5173` and proxies same-origin `/api` requests to the API during development. PostgreSQL, Redis and MinIO must be running before the API starts. Run `pnpm dev` and `pnpm dev:web` in separate terminals.

Before the first browser test run, install the repository-local Chromium runtime:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '0'
pnpm --filter @ai-knowledge/web exec playwright install chromium
```

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

Chat and embedding providers use separate OpenAI-compatible settings. Configure `CHAT_BASE_URL`, `CHAT_MODEL` and optional `CHAT_API_KEY` for answers; configure `EMBEDDING_BASE_URL`, `EMBEDDING_MODEL` and optional `EMBEDDING_API_KEY` for vector retrieval. Without embeddings the system safely degrades to keyword retrieval; without chat configuration the answer endpoint returns a structured `503`.

See [`docs/deployment.md`](docs/deployment.md) for release, health verification and rollback instructions. GitHub Actions runs lint, typecheck, unit tests, builds and a high-severity dependency audit on pushes and pull requests.

## Repository Layout

```text
apps/api/         NestJS HTTP API
apps/web/         React web application
docs/             Specifications, decisions, and evidence
Dockerfile        Multi-stage production image
docker-compose.yml Local PostgreSQL, Redis, MinIO, and API stack
```

## Authoritative Sources

- NestJS first steps: https://docs.nestjs.com/first-steps
- NestJS validation: https://docs.nestjs.com/techniques/validation
- NestJS authentication: https://docs.nestjs.com/security/authentication
- NestJS SQL integrations: https://docs.nestjs.com/techniques/sql
- TypeORM migrations: https://typeorm.io/docs/advanced-topics/migrations
- Testcontainers for Node.js: https://node.testcontainers.org/
- pnpm workspaces: https://pnpm.io/workspaces
