# CMS Backend Resume Evidence Matrix

Status: Baseline draft  
Evidence date: 2026-07-10

## Usage Rule

A resume bullet is publishable only when every material claim is supported by repository or runtime evidence. Framework choice proves implementation approach; it does not prove throughput, reliability, security, or business impact.

Evidence levels:

- **Supported**: directly visible in code and verified by a command or test.
- **Partially supported**: implementation exists, but runtime behavior or edge cases are not tested.
- **Contradicted**: current code contains behavior that invalidates the claim.
- **Unverified**: no measurement or authoritative artifact exists.

## Current Claim Review

| Existing claim | Status | Evidence | Resume action |
| --- | --- | --- | --- |
| Built an asynchronous CMS backend with FastAPI and SQLAlchemy Async | Supported | Async route handlers, `AsyncSession`, async Redis client, and successful application import | Keep, without claiming higher throughput |
| Implemented user, category, post, and comment REST APIs | Supported | Models, schemas, and declared routes import successfully | Keep |
| Implemented JWT authentication with Redis-backed server sessions | Partially supported | Login writes `session:{sid}` and protected requests check existence; no integration test currently proves expiry/logout behavior | Keep as implementation detail; do not call it secure or production-ready |
| Logout makes an issued token immediately unusable | Partially supported | Logout deletes the Redis key and authentication checks key existence; Docker runtime path was not exercised | Use only after an integration test proves the full flow |
| Implemented Admin/User role control | Contradicted | Public registration accepts and persists `role=admin` | Remove until Phase 1 is complete |
| Implemented fine-grained permission control | Contradicted | Only two roles and one administrator dependency exist; public privilege escalation bypasses the intended boundary | Remove |
| Security mechanisms are complete | Contradicted | Default secret, default administrator password, privilege escalation, and vulnerable dependencies are present | Remove |
| Implemented IP + path Redis rate limiting | Partially supported | `INCR` and `EXPIRE` are implemented; atomicity, proxy identity, resource-path bypass, and failure behavior are untested | Describe the mechanism, not its effectiveness |
| High-performance or high-concurrency backend | Unverified | Async libraries are used, but no benchmark, concurrency test, or production metric exists | Remove until a reproducible benchmark exists |
| Full-chain asynchronous I/O improves throughput | Unverified | Async code path exists; no before/after comparison proves improvement | Replace with factual architecture wording |
| Docker Compose provides one-command startup | Partially supported | Compose configuration parses; daemon was stopped, so build, readiness, and business flow were not verified | Say "Docker Compose orchestration" until clean-machine verification passes |
| Containerization significantly reduced setup cost | Unverified | No measured setup time or comparison exists | Remove "significantly" and any percentage |
| Production and development environments are consistent | Unverified | Compose exists, but no production deployment or environment parity evidence exists | Remove |

## Publishable Baseline Wording

This wording is intentionally conservative and can be used before refactoring:

> Implemented a CMS backend with FastAPI and SQLAlchemy Async, covering user, category, post, and comment REST APIs backed by MySQL; used Redis to store server-side login sessions and implement request counters by client IP and path; orchestrated the API, MySQL, and Redis services with Docker Compose.

Chinese version:

> 基于 FastAPI 与 SQLAlchemy Async 实现 CMS 后端，完成用户、分类、文章和评论等 REST API，并使用 MySQL 持久化数据；通过 Redis 保存服务端登录会话并实现基于客户端 IP 与路径的请求计数，使用 Docker Compose 编排 API、MySQL 和 Redis 服务。

Do not currently add:

- enterprise-grade, production-ready, high availability, or high concurrency;
- secure/fine-grained RBAC;
- performance improvements or percentages;
- test coverage, migration reliability, or CI claims;
- claims that Docker startup was verified on a clean machine.

## Evidence Required for Stronger Bullets

### After Phase 1: Authentication Hardening

Required evidence:

- abuse-case tests for self-assigned roles and forged tokens;
- integration tests for login, session validation, logout, and expiry;
- configuration test rejecting placeholder production secrets;
- dependency audit with no unaccepted reachable high/critical advisory.

Eligible wording pattern after evidence exists:

> Hardened the authentication boundary by separating public registration from privileged role assignment, validating JWT purpose and Redis session ownership, and covering privilege-escalation, token-forgery, logout, and expiry abuse cases with automated tests.

Use the actual number of tests only after collecting it from the test report.

### After Phase 2: Migration and Transaction Correctness

Required evidence:

- Alembic upgrade/downgrade rehearsal logs;
- schema-drift check;
- concurrent uniqueness-conflict integration test;
- documented error contract.

Eligible wording pattern:

> Replaced startup-time schema creation with versioned Alembic migrations and added database-conflict handling, making fresh-environment initialization and schema evolution reproducible through automated migration tests.

### After Phase 3: Bounded API Behavior

Required evidence:

- contract tests for pagination and validation boundaries;
- query plans for indexed list filters/order;
- documented maximum page and input sizes.

Eligible wording pattern:

> Added bounded pagination, filtering, stable sorting, and input-size policies for content APIs, preventing unbounded list responses and oversized writes while preserving documented API contracts.

Do not claim a latency improvement unless Phase 4 benchmark data proves it.

### After Phase 4: Delivery and Operability

Required evidence:

- clean-checkout CI run covering lint, types, tests, migrations, and dependency audit;
- liveness/readiness failure tests;
- redaction tests for security logs;
- reproducible benchmark report containing environment and workload details.

Eligible wording pattern:

> Built an automated quality gate for linting, type checks, tests, migrations, and dependency auditing; added dependency-aware readiness and structured security events to make startup and authentication failures diagnosable.

Performance wording must use measured results in this form:

> Under `[documented workload]`, achieved `[measured throughput]` with `[measured p95 latency]` and `[measured error rate]` in the recorded container environment.

Never fill those values from estimates.

## Interview Evidence Map

| Interview topic | Artifact needed | Demonstration |
| --- | --- | --- |
| Why JWT plus Redis session | ADR or security design note and logout integration test | Login, access protected endpoint, logout, retry token and receive 401 |
| How privilege escalation is prevented | Registration schema/policy and abuse-case test | Submit `role=admin` and show rejection or ignored field |
| How schema changes are managed | Alembic revisions and migration rehearsal | Upgrade empty database to head and show current revision |
| How rate limiting behaves | Policy tests and Redis integration test | Hit threshold, receive 429, verify recovery after window |
| How failures are diagnosed | Structured logs and readiness tests | Stop Redis/MySQL and show readiness/log behavior without secret leakage |
| Why performance claims are credible | Benchmark script, environment manifest, raw summary | Re-run the same workload and compare within documented variance |

## Tailoring Inputs Still Required

The final resume section cannot be completed without:

1. the current resume source;
2. the target role and representative job description;
3. the meaning of `2026.3`;
4. the desired language and page limit;
5. confirmed project ownership dates and whether the work was individual or collaborative.
