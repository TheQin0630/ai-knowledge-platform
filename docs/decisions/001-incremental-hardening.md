# ADR-001: Incrementally Harden the Existing FastAPI Application

## Status

Proposed

## Date

2026-07-10

## Context

The project is a small, working FastAPI CMS MVP with asynchronous SQLAlchemy, MySQL, Redis-backed sessions and rate limiting, and Docker Compose orchestration. It also has security defects, no automated tests, no migration configuration, no version-control metadata in the provided directory, and no measured performance baseline.

The goal is to make the project credible for backend engineering interviews and closer to production engineering practice. A common response would be to rewrite it or add controller/service/repository layers everywhere. Neither approach directly fixes the highest-risk defects, and both make behavioral regressions harder to detect while no tests exist.

## Proposed Decision

Keep the current FastAPI, SQLAlchemy, MySQL, and Redis architecture. Improve it through small, test-backed changes ordered by risk:

1. establish recovery and verification;
2. fix authentication and configuration defects;
3. version the database schema and transactions;
4. bound API behavior;
5. add operability and delivery gates;
6. publish only measured resume claims.

Introduce a service module only when a use case owns multi-step orchestration, transaction rules, or reusable business policy. Do not add a generic repository layer while it would only wrap SQLAlchemy calls one-for-one.

## Alternatives Considered

### Full Rewrite

Pros:

- can start with a clean directory structure;
- avoids adapting some prototype decisions.

Cons:

- discards working behavior before it is characterized;
- creates a large, difficult-to-review change;
- hides whether defects were understood and fixed;
- produces weaker interview evidence than an incremental, measured improvement.

Rejected unless the owner identifies incompatible business requirements.

### Layer-First Refactor

Pros:

- creates familiar controller/service/repository names quickly;
- may help later if business logic grows substantially.

Cons:

- does not address the administrator escalation or default-secret defects;
- adds pass-through abstractions to a small codebase;
- moves code without proving reduced complexity.

Rejected as the starting point. Focused services remain available when justified by real use cases.

### Feature-First Expansion

Pros:

- adds visible resume keywords such as search, queues, or microservices.

Cons:

- expands the attack surface and maintenance burden on an untested base;
- leaves existing correctness and security defects intact;
- makes claims broader but less defensible.

Rejected until the readiness criteria in the refactoring spec are met.

## Consequences

Positive:

- each phase has a clear verification story;
- the highest-risk defects are addressed first;
- changes remain small enough to review and explain in interviews;
- resume improvements follow evidence rather than tool count.

Negative:

- visible feature growth is delayed;
- some API and setup behavior may change during security hardening;
- the project owner must decide data compatibility, target role, and deployment assumptions before those phases proceed.

## Approval Needed

The project owner should accept, amend, or reject this ADR before code implementation begins.
