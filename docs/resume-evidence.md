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
| Uses migration-driven PostgreSQL identity persistence with pgvector | Testcontainers and CLI both passed upgrade, constraint, rollback, and re-upgrade checks | Supported |
| Implements secure authentication, RAG, or AI evaluation | Not implemented | Do not claim |

## Current Safe Wording

> Replatformed a course-level Python CMS prototype into a strict TypeScript and NestJS workspace with automated quality gates and a hardened non-root container; established migration-driven PostgreSQL/pgvector persistence and Testcontainers coverage for reversible schema changes, normalized email uniqueness, and least-privilege user-role defaults.

Chinese version:

> 将课程级 Python CMS 原型迁移为 TypeScript 严格模式的 NestJS 工程，建立自动化质量门禁与非 root 容器运行基线；使用 TypeORM 构建迁移驱动的 PostgreSQL/pgvector 持久化层，并通过 Testcontainers 验证可逆迁移、邮箱规范化唯一约束与最小权限角色默认值。

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
