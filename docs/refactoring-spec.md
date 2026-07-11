# AI Knowledge Platform Refactoring Specification

Status: Active  
Date: 2026-07-10  
Decision: ADR-002

## Objective

Replace the legacy CMS with an enterprise-oriented AI knowledge backend that ingests documents, performs hybrid retrieval, returns cited RAG answers, and proves quality through reproducible evaluation.

Success means the repository demonstrates secure backend engineering and measurable AI application behavior. Framework names alone are not success criteria.

## Product Scope

### MVP

1. Secure user authentication and workspace authorization.
2. Document upload metadata and S3-compatible object storage.
3. Asynchronous parsing, chunking, embedding, and index versioning.
4. PostgreSQL full-text plus pgvector hybrid retrieval.
5. Streaming answers with source citations.
6. User feedback and failed-query capture.
7. Versioned golden datasets and retrieval/RAG regression reports.
8. Structured logs, traces, liveness, readiness, and dependency health.

### Not Doing

- model training or fine-tuning before retrieval quality is measured;
- Kubernetes, Kafka, or microservices for portfolio keywords;
- a separate vector database before pgvector limits are demonstrated;
- an autonomous general-purpose agent;
- a broad CMS feature set unrelated to knowledge ingestion and retrieval.

## Technology Baseline

- Node.js 24.14.0
- pnpm 11.7.0 with a committed lockfile and dependency-build allowlist
- NestJS 11 in strict TypeScript mode
- PostgreSQL 17 with pgvector 0.8.5
- Redis 8.4
- Docker Compose for local integration
- Jest, Supertest, ESLint, Prettier, and TypeScript compiler gates

Exact application dependency versions are authoritative in `pnpm-lock.yaml`.

## Repository Structure

```text
apps/api/                  NestJS HTTP API
  src/modules/             Business-owned modules
docs/decisions/            Architecture decisions
docs/evidence/             Reproducible test, security, and benchmark summaries
Dockerfile                 Multi-stage non-root production image
docker-compose.yml         pgvector/PostgreSQL, Redis, and API
```

Add a worker application only when the first ingestion job is implemented. Do not create empty packages for a future architecture diagram.

## Commands

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
docker compose --env-file .env.example config --quiet
docker compose up --build --wait
```

## API Contract Rules

- Prefix public endpoints with `/api/v1`.
- Use plural resource nouns and explicit sub-resources.
- Validate concrete DTO classes at the HTTP boundary.
- Reject undocumented fields rather than silently persisting them.
- Return one machine-readable error envelope.
- Paginate every collection from its first release.
- Keep liveness independent of dependencies and readiness dependent on them.
- Stream answer events with a documented terminal and error event.

## Testing Strategy

### Unit

- configuration and secret validation;
- role and workspace authorization policies;
- chunking invariants and token bounds;
- retrieval fusion and citation mapping;
- provider response validation and error mapping.

### Integration

- migrations on an empty PostgreSQL database;
- uniqueness and transaction conflict behavior;
- Redis session, rate-limit, and job state;
- pgvector and full-text retrieval with metadata filters;
- object storage upload and cleanup.

### End to End

- register, login, access, logout, and privilege-escalation abuse cases;
- upload through indexed document state;
- query through streamed cited answer;
- dependency failure reflected in readiness without breaking liveness.

### AI Evaluation

- version a small golden question/document dataset;
- measure Recall@K and MRR before answer generation;
- measure citation coverage and unsupported-claim rate;
- store model, embedding, prompt, index, dataset, and environment versions;
- never gate deterministic CI on an uncontrolled live-model response.

## Phased Delivery

### Phase 0: Reproducible Runtime

Delivered:

- Git baseline and legacy tag;
- strict NestJS workspace and quality gates;
- non-root, read-only API image;
- healthy pgvector/PostgreSQL, Redis, and API Compose stack;
- validated application configuration;
- PostgreSQL connection and dependency-aware readiness.

Remaining:

- Redis connectivity and readiness;
- CI workflow and automated dependency audit.

Risk: infrastructure can look complete while the API has no real dependency path.  
Verify: stop each dependency and assert liveness/readiness behavior separately.

### Phase 1: Secure Identity and Persistence

Delivered:

- reversible migrations and the initial user identity table;
- Redis-backed revocable session persistence;
- least-privileged public registration;
- Argon2id password hashing with bounded inputs;
- refresh and access tokens bound to user, session, and purpose;
- distributed login abuse controls and correlated, redacted security events.

Risk: auth rewrites can preserve the same privilege escalation under a new framework.  
Verify: tests for self-assigned roles, forged tokens, session mismatch, expiry, logout, duplicate identity, atomic login-limit concurrency, fixed-window recovery, spoofed proxy headers, fail-closed dependency errors, and security-event redaction.

### Phase 2: Knowledge Ingestion

- workspace, knowledge base, document, and version models;
- bounded upload contracts and object storage;
- idempotent parse, chunk, embed, and index jobs;
- retry and dead-letter behavior with traceable job state.

Risk: retries can duplicate chunks or publish partial indexes.  
Verify: idempotency, state transitions, checksum reuse, retry limits, and atomic active-version switch.

### Phase 3: Hybrid Retrieval and Cited RAG

- PostgreSQL full-text and pgvector candidate retrieval;
- deterministic fusion and metadata authorization filters;
- model-provider interface and streamed answer events;
- citations resolved only from retrieved chunks.

Risk: a plausible answer can hide poor retrieval or cross-workspace leakage.  
Verify: Recall@K/MRR, tenant isolation, citation existence, empty-context behavior, and prompt-injection cases.

### Phase 4: Evaluation and Operability

- golden dataset runner and stored reports;
- structured logs, OpenTelemetry traces, and model cost/latency attributes;
- readiness, queue depth, ingestion failure, and model error metrics;
- clean-checkout CI and container security checks.

Risk: LLM judge scores are nondeterministic and can reward style over truth.  
Verify: deterministic retrieval gates remain primary; judge model/version and variance are recorded.

### Phase 5: Resume Evidence

- map each bullet to a commit, test report, evaluation report, or benchmark;
- tailor terminology to the supplied AI application job description;
- include only measured scale, latency, quality, and coverage values.

Risk: adding invented percentages destroys interview credibility.  
Verify: every number can be reproduced from a documented command.

## Boundaries

Always:

- test behavior before implementation;
- keep changes independently buildable and committed;
- validate untrusted HTTP, file, model, and retrieval data at boundaries;
- redact credentials and document content from logs by default.

Ask first:

- breaking public API contracts;
- destructive migrations or data resets;
- adding a second language/runtime or external managed service;
- changing the target role away from AI application development.

Never:

- commit secrets, uploaded documents, model responses containing private data, or local databases;
- trust model output as SQL, HTML, a shell command, or an authorization decision;
- claim enterprise readiness from architecture diagrams without failure tests;
- add infrastructure only to create resume keywords.

## Completion Criteria

The project is complete when:

1. all phases have passing named verification commands;
2. clean database and object-store initialization is migration-driven;
3. authorization prevents cross-workspace reads and writes;
4. ingestion is idempotent and observable;
5. hybrid retrieval and citations meet stored evaluation thresholds;
6. liveness, readiness, logs, traces, and alerts expose dependency failures safely;
7. CI reproduces tests, build, migrations, audits, and container checks;
8. resume wording is supported by repository evidence and a target JD.

## Open Inputs

- Copy `2026.3.docx` into this repository before resume editing.
- Add a representative AI application development job description.
- Choose the first supported model provider before Phase 3.
