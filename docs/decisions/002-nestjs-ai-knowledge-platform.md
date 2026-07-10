# ADR-002: Build an AI Knowledge Platform with NestJS

## Status

Accepted

## Date

2026-07-10

## Context

The original project was a small FastAPI CMS with MySQL and Redis. Its code and runtime evidence showed insecure role assignment, placeholder secrets, a default administrator, unbounded inputs and lists, vulnerable dependencies, no migrations, and no automated tests.

The target role is AI application development. A conventional CMS does not demonstrate the retrieval, model integration, evaluation, tracing, and asynchronous ingestion skills expected from that role. The owner also requested a backend stack other than FastAPI.

## Decision

Build a modular AI knowledge platform using:

- Node.js 24 and strict TypeScript;
- NestJS 11 for the HTTP API and module boundaries;
- PostgreSQL 17 with pgvector for transactional and vector data;
- Redis for caching, rate limits, session state, and BullMQ coordination;
- S3-compatible object storage when document ingestion is introduced;
- direct OpenAI-compatible provider interfaces for model and embedding calls;
- LangGraph.js only for workflows that require persistent branching or tool orchestration;
- retrieval metrics and a versioned golden dataset as the primary AI quality gate;
- OpenTelemetry and Langfuse-compatible tracing for runtime and model-call evidence.

Start as a modular monolith plus background worker. Split services only when an independently scaled workload and measured operational need justify it.

The previous implementation remains available under the Git tag `legacy-fastapi-baseline` and is explicitly non-deployable.

## Alternatives Considered

### Keep FastAPI

Rejected for this portfolio direction at the owner's request. Python remains a valid production choice, but keeping the framework would not satisfy the desired language and architecture differentiation.

### Spring Boot and Spring AI

Strong enterprise conventions, but it adds a larger language and build-system transition while offering less direct reuse across TypeScript-based model SDKs, streaming clients, and agent tooling. It remains a valid alternative for Java-focused job descriptions.

### Separate Python AI Microservice from Day One

Rejected until a Python-only model, parser, or local inference requirement exists. Adding a second runtime before that need would multiply deployment, contracts, tests, and failure modes without increasing user value.

### Dedicated Vector Database

Rejected for the initial scale. PostgreSQL plus pgvector keeps metadata filters, transactions, full-text retrieval, and vector search in one operational boundary. Revisit only after measured index or latency limits.

## Consequences

Positive:

- the project directly demonstrates AI application engineering rather than generic CRUD;
- strict TypeScript, NestJS modules, and contract tests create explicit boundaries;
- hybrid retrieval can share transactions and filters with application metadata;
- every AI claim can be tied to a stored evaluation artifact.

Negative:

- the application code is a rewrite rather than an in-place refactor;
- previous Python implementation knowledge does not transfer line-for-line;
- TypeScript AI libraries may not cover every local-model or scientific workflow;
- background jobs and model providers introduce new failure and cost controls.

## Guardrails

- No Kubernetes, Kafka, or service split without measured need.
- No LangChain wrapper around a single model call or retrieval query.
- No resume claim for latency, retrieval quality, or faithfulness without a reproducible artifact.
- No public endpoint may choose an administrator role or accept undocumented properties.
