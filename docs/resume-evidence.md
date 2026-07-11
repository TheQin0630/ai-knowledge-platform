# AI Knowledge Platform Resume Evidence

Status: In progress  
Evidence date: 2026-07-11

## Rule

Every resume claim must map to a commit plus a reproducible test, runtime check, evaluation report, or benchmark. Tool selection is not an outcome.

## Verified Today

| Claim | Evidence | Resume status |
| --- | --- | --- |
| Built a strict NestJS and React TypeScript workspace | Commits on `refactor/nestjs-ai-platform` and passing root quality gates | Supported |
| Established unit, E2E, lint, typecheck, and build gates | Root pnpm commands all pass | Supported |
| Built a multi-stage Node 24 production image | Docker build completed from a 525 KB context | Supported |
| Runs the API without root privileges on a read-only filesystem | Runtime UID 1000, read-only root, all Linux capabilities dropped | Supported |
| Orchestrates API, pgvector/PostgreSQL, and Redis with health checks | Full Compose stack reported healthy; readiness now reports PostgreSQL and Redis independently while liveness performs no dependency calls | Supported |
| Uses migration-driven PostgreSQL identity persistence with pgvector | Testcontainers and CLI passed upgrade, constraint, rollback, re-upgrade, Nest connection, and readiness checks | Supported |
| Implements least-privilege authentication with revocable sessions and abuse controls | Registration, Argon2id, purpose-bound JWT, Cookie, Redis rotation/replay/revocation, atomic distributed login limiting, fail-closed dependency handling, correlated security events, E2E, and Testcontainers attack tests passed | Supported |
| Implements workspace authorization, RAG, or AI evaluation | Not implemented | Do not claim |

## Current Safe Wording

> Built a strict TypeScript, NestJS, and React workspace with automated quality gates and a hardened non-root container; established migration-driven PostgreSQL/pgvector persistence and implemented least-privilege authentication with Argon2id, purpose-bound JWTs, atomic Redis refresh rotation, distributed login abuse controls, correlated security events, and Testcontainers attack-chain coverage.

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
