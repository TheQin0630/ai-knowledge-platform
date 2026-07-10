# AI Knowledge Platform Resume Evidence

Status: In progress  
Evidence date: 2026-07-10

## Rule

Every resume claim must map to a commit plus a reproducible test, runtime check, evaluation report, or benchmark. Tool selection is not an outcome.

## Verified Today

| Claim | Evidence | Resume status |
| --- | --- | --- |
| Migrated from a FastAPI prototype to a strict NestJS workspace | Git tag `legacy-fastapi-baseline` and commits on `refactor/nestjs-ai-platform` | Supported |
| Established unit, E2E, lint, typecheck, and build gates | Root pnpm commands all pass | Supported |
| Built a multi-stage Node 24 production image | Docker build completed from a 525 KB context | Supported |
| Runs the API without root privileges on a read-only filesystem | Runtime UID 1000, read-only root, all Linux capabilities dropped | Supported |
| Orchestrates API, pgvector/PostgreSQL, and Redis with health checks | Full Compose stack reported healthy | Supported |
| Implements secure authentication, RAG, or AI evaluation | Not implemented | Do not claim |

## Current Safe Wording

> Replatformed a course-level Python CMS prototype into a strict TypeScript and NestJS workspace, establishing unit/E2E tests, lint and type gates, and a multi-stage non-root Docker runtime; orchestrated the API with PostgreSQL/pgvector and Redis using dependency health checks and isolated local ports.

Chinese version:

> 将课程级 Python CMS 原型迁移为 TypeScript 严格模式的 NestJS 工程，建立单元测试、E2E、Lint、类型检查与构建门禁；使用多阶段 Docker 构建非 root、只读文件系统的 API 镜像，并完成 API、PostgreSQL/pgvector 与 Redis 的健康编排。

This is an interim engineering bullet, not yet the final AI project bullet.

## Evidence Needed for AI Claims

### Ingestion

- idempotency and retry integration tests;
- document/chunk/index version counts from a controlled fixture;
- failure and recovery traces.

### Retrieval

- versioned dataset and corpus;
- Recall@K and MRR report;
- metadata isolation tests;
- identical workload before/after any claimed optimization.

### RAG

- citation coverage and unsupported-claim report;
- model, prompt, index, and embedding versions;
- streamed API contract and error tests;
- prompt-injection and empty-context cases.

### Operability

- clean CI run;
- dependency failure tests;
- redaction tests;
- p50/p95/p99 latency, throughput, error rate, and test environment.

## Forbidden Until Proven

- high concurrency, high availability, production ready, or enterprise grade;
- improved accuracy or latency without a baseline and identical workload;
- secure RBAC before abuse-case tests pass;
- reduced cost without recorded token and provider pricing inputs;
- any percentage copied from an estimate.

## Inputs Still Required

1. `2026.3.docx` placed inside this repository.
2. A representative AI application development job description.
3. Confirmed individual/collaborative ownership and project dates.
