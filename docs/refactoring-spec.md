# CMS Backend Enterprise Readiness Refactoring Spec

Status: Draft, awaiting owner review  
Date: 2026-07-10

## 1. Objective

Evolve the current FastAPI CMS MVP into a backend project that demonstrates production-oriented engineering practices without rewriting working functionality or adding layers only for appearance.

The target outcome is:

- authentication and authorization behavior is secure and covered by abuse-case tests;
- database changes are versioned and reproducible;
- API inputs and collection queries have explicit bounds;
- runtime dependencies are observable and have meaningful health checks;
- automated quality gates make the build repeatable;
- every resume claim is backed by code, tests, audit output, or measured runtime data.

Assumptions requiring owner confirmation:

1. The target role is a Python backend internship or graduate position.
2. MySQL and Redis remain the production-facing data stores.
3. Existing API paths may be preserved, but insecure request fields may be removed.
4. `2026.3` is a resume or project date, not a required framework version.
5. The current directory is an exported copy or may be initialized as a Git repository before implementation.

## 2. Current Evidence Baseline

Verified on 2026-07-10:

- 29 Python files parse successfully.
- The application imports with the pinned dependencies and assembles all declared routes.
- No automated tests, Git metadata, CI workflow, Alembic configuration, `.gitignore`, or `.dockerignore` were found.
- Public registration accepts `role=admin` and persists it unchanged.
- The default JWT secret can sign a token accepted by the application.
- `PostCreate` accepts a 1 MB content string because no content limit is defined.
- `pip-audit -r requirements.txt` reports 22 vulnerability records across 5 packages. Duplicate advisory records must be normalized before reporting a final count.
- Docker Compose configuration parses, but end-to-end container verification was not run because the Docker daemon was stopped.

These observations are a baseline, not proof of production readiness.

## 3. Scope

### In Scope

- authentication, authorization, session, and secret hardening;
- dependency upgrades and vulnerability policy;
- pytest-based unit and integration tests;
- Alembic migrations and removal of startup schema mutation;
- bounded pagination, filtering, sorting, and input validation;
- consistent API errors and transaction handling;
- health, readiness, structured logging, and security audit events;
- Docker and CI quality gates;
- reproducible performance baseline;
- evidence-based project and resume documentation.

### Out of Scope Until Requested

- replacing FastAPI, SQLAlchemy, MySQL, or Redis;
- adding Kubernetes, microservices, message queues, Elasticsearch, or distributed tracing solely for resume keywords;
- building a frontend;
- social login, payment, file upload, or multi-tenant features;
- a generic repository layer where SQLAlchemy is already an adequate boundary.

## 4. Commands

Current commands:

```powershell
docker compose config --quiet
docker compose up --build
```

Target commands after the relevant phase is implemented:

```powershell
python -m pytest -q
python -m pytest --cov=app --cov-report=term-missing
python -m ruff check app tests
python -m mypy app
python -m alembic upgrade head
python -m alembic downgrade -1
python -m pip_audit -r requirements.txt
docker compose up --build --wait
```

Commands must be runnable from the repository root in a documented Python 3.12 environment.

## 5. Target Project Structure

```text
app/
  api/              HTTP transport and dependency wiring
  core/             configuration, security, logging, and shared policies
  db/               engine/session lifecycle and migration integration
  models/           persistence models
  schemas/          request and response contracts
  services/         business use cases only when a route contains real orchestration
alembic/             versioned schema migrations
tests/
  unit/              pure policy and validation tests
  integration/       API + MySQL + Redis behavior
  contract/          OpenAPI and error-shape checks
docs/
  decisions/         architecture decision records
  evidence/          audit, coverage, and benchmark summaries
```

The structure is a destination, not a requirement to create empty packages.

## 6. Code Style

- Use explicit types at API and service boundaries.
- Keep route functions focused on HTTP translation and use-case orchestration.
- Put authorization decisions in named policies or dependencies and test them directly.
- Use SQLAlchemy parameterized expressions; never construct SQL with user input.
- Map expected database conflicts to stable API errors instead of returning raw 500 responses.
- Add comments only for non-obvious intent or operational constraints.

Example target shape:

```python
@router.post("/register", response_model=CurrentUser, status_code=201)
async def register_user(
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CurrentUser:
    user = await auth_service.register_user(db, payload)
    return CurrentUser.model_validate(user)
```

The service extraction is justified only when it owns transaction, conflict, or policy logic.

## 7. Testing Strategy

### Unit Tests

- configuration rejects unsafe production defaults;
- public registration cannot assign privileged roles;
- JWT claims and expiry rules are enforced;
- pagination and input-boundary validation;
- rate-limit key and window policy.

### Integration Tests

- registration, login, authenticated request, logout, and expired session;
- ordinary users receive 403 for administrator operations;
- forged, expired, malformed, and cross-user session tokens receive 401;
- duplicate username/category conflicts return stable 409 responses;
- Alembic upgrades an empty database to head;
- MySQL and Redis failures change readiness state;
- list endpoints enforce default and maximum page sizes;
- rate limits expire and cannot be bypassed by varying resource identifiers.

### Contract Tests

- OpenAPI exposes the intended authentication scheme;
- error responses share one documented shape;
- create endpoints return 201 and missing resources return 404;
- deliberate API compatibility changes are recorded.

### Performance Tests

Define one reproducible workload after functional correctness is stable:

- fixed dataset size and seed procedure;
- fixed concurrency, duration, machine/container limits, and endpoint mix;
- report throughput, error rate, and p50/p95/p99 latency;
- compare before and after only under identical conditions.

No performance number may appear in the resume until the workload and raw result are stored under `docs/evidence/`.

### Coverage Gates

- authentication and authorization branches: at least 90%;
- overall application line coverage: at least 80%;
- coverage never substitutes for the named abuse-case and integration tests above.

## 8. Phased Plan, Risks, and Verification

### Phase 0: Recovery and Reproducibility Baseline

Work:

- confirm repository ownership and initialize or locate Git history;
- add ignore files and document Python 3.12 setup;
- capture current dependency audit and route inventory.

Risks:

- editing an exported copy could separate changes from the real repository;
- ignore rules added after secrets are committed do not remove them from history.

Verification:

- clean Git working tree after a baseline commit;
- a fresh clone can install dependencies and import the application;
- no `.env`, key, token, or local database artifact is tracked.

### Phase 1: Authentication and Dependency Hardening

Work:

- remove privileged role selection from public registration;
- require a strong non-default secret outside development;
- replace automatic default-admin creation with an explicit bootstrap command;
- bind Redis session values to the authenticated user and validate token purpose;
- upgrade or replace vulnerable dependencies as a compatible set;
- add abuse-case tests before changing behavior.

Risks:

- existing demonstration instructions and seeded credentials will stop working;
- dependency upgrades may change request parsing or JWT behavior;
- changing authentication without regression tests can lock out valid users.

Verification:

- all named authentication tests pass;
- an unauthenticated client cannot create or impersonate an administrator;
- production-mode startup rejects missing or placeholder secrets;
- dependency audit has no unaccepted reachable high/critical finding;
- every accepted advisory has reachability reasoning, owner, and review date.

### Phase 2: Database Lifecycle and Transaction Correctness

Work:

- configure Alembic and create a reviewed initial migration;
- stop mutating schema during application startup;
- define transaction ownership and rollback behavior;
- map uniqueness and foreign-key conflicts to stable API errors;
- add startup retry/health coordination for Compose.

Risks:

- an incorrect baseline migration can diverge from existing databases;
- MySQL DDL behavior makes downgrade assumptions unsafe;
- check-then-insert races remain unless database errors are handled.

Verification:

- empty database: upgrade to head succeeds;
- migration rehearsal: upgrade, downgrade one revision, and re-upgrade succeeds where supported;
- schema comparison shows no unintended drift;
- concurrent duplicate creation produces one success and one documented conflict.

### Phase 3: Bounded API and Maintainable Use Cases

Work:

- add page-size limits, filtering, sorting, and stable ordering;
- cap title, content, comment, username, and password inputs intentionally;
- define consistent response and error contracts;
- extract services only for multi-step business transactions or reusable policies.

Risks:

- pagination changes response contracts;
- offset pagination can become slow on deep pages;
- premature abstraction can make a small codebase harder to navigate.

Verification:

- boundary and contract tests cover minimum, default, maximum, and invalid values;
- query plans are inspected for indexed filters and ordering;
- no list endpoint can return an unbounded collection.

### Phase 4: Operability and Delivery

Work:

- separate liveness and readiness;
- add structured request, error, login-failure, and authorization-denial events;
- configure Docker health checks and a non-root API user;
- add lint, type, test, migration, and dependency-audit CI gates;
- run the documented performance workload.

Risks:

- logs can leak tokens or passwords;
- readiness checks can overload dependencies if uncached or too frequent;
- CI that depends on timing-sensitive services can become flaky.

Verification:

- secrets and credentials are redacted from logs;
- dependency failure is reflected in readiness but not liveness;
- CI passes from a clean checkout;
- performance results include workload definition and raw summary.

### Phase 5: Resume and Interview Evidence

Work:

- replace unsupported claims in the current report and interview script;
- create an evidence matrix linking each bullet to tests, audit, migration, or benchmark output;
- tailor keywords and bullet ordering to the target job description.

Risks:

- invented percentages damage credibility under interview questioning;
- listing tools without explaining decisions makes the project look tutorial-level;
- claiming enterprise readiness before deployment evidence overstates the result.

Verification:

- every quantitative claim has a stored result and reproducible command;
- every security claim has at least one abuse-case test;
- every interview talking point can be demonstrated in the repository.

## 9. Boundaries

Always:

- write or identify a failing behavioral test before changing behavior;
- keep each change independently runnable and reviewable;
- run focused tests, then the full suite and dependency audit;
- update this spec when an approved decision changes scope.

Ask first:

- authentication or authorization contract changes;
- database schema changes or destructive migrations;
- adding or replacing a runtime dependency;
- breaking response shapes or endpoint paths;
- changing deployment topology or exposing new ports.

Never:

- commit secrets or real credentials;
- delete failing tests to make a gate pass;
- claim performance, availability, or coverage results that were not measured;
- introduce infrastructure only to add resume keywords;
- remove existing behavior whose business intent is unknown.

## 10. Success Criteria

The refactoring is complete only when all of the following are proven:

1. Security abuse cases pass and no public path can grant administrator access.
2. Production configuration contains no operational default secret or default account.
3. Database state is reproducible exclusively through reviewed migrations.
4. API inputs and collection results are explicitly bounded.
5. Expected conflicts return documented errors instead of unhandled 500 responses.
6. Liveness, readiness, logs, and audit events expose runtime behavior without leaking credentials.
7. CI reproduces lint, type, test, migration, and dependency-security checks from a clean checkout.
8. A documented performance workload produces repeatable results.
9. Project documentation matches the implemented behavior.
10. Resume bullets are tailored to the target role and linked to verifiable evidence.

## 11. Open Questions

1. What does `2026.3` mean: project end date, resume version, or application deadline?
2. What exact role and job description should the resume target?
3. Where is the current resume source file?
4. Is this directory the authoritative repository, an export, or a copy without `.git`?
5. Should public article and comment reads remain unauthenticated while category reads require login?
6. Is self-registration required in the intended business model?
7. Must existing databases/data be migrated, or may the development database be recreated?
8. What deployment target and expected traffic should define the performance workload?

Implementation must not begin on an unresolved item that changes authentication, data compatibility, or public API behavior.
