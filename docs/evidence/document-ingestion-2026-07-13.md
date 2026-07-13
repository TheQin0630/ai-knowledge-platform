# Document Ingestion Evidence

Date: 2026-07-13  
Branch: `refactor/nestjs-ai-platform`

## Delivered Behavior

- Reversible document and document-version persistence model.
- S3-compatible MinIO source storage with ID-only object keys.
- Single-file PDF, DOCX, TXT and Markdown upload, 25 MB limit and content checks.
- Case-insensitive same-name immutable versioning.
- BullMQ queued/processing/ready/failed transitions, three automatic attempts and manual retry.
- Real PDF/DOCX/plain-text extraction without OCR, chunking or embeddings.
- Workspace owner/admin management and member read-only authorization.
- React upload queue with client progress, server-state polling, document list, version detail and retry.
- Desktop and mobile responsive layouts with labelled controls and live upload status.

## Verification

- API unit: 12 suites, 67 tests passed.
- Web unit: 3 suites, 11 tests passed.
- Migration integration: applies three migrations, verifies constraints, reverts each layer and reapplies all three.
- PostgreSQL/Redis/MinIO/BullMQ integration: 5 suites, 13 tests passed.
- API E2E: 2 suites, 21 tests passed.
- Playwright Chromium: 10 tests passed across 1440 x 900 desktop and 390 x 844 mobile projects.
- API and Web strict typecheck, lint and production builds passed.
- Dependency audit reported no known vulnerabilities; `git diff --check` passed.

## Reproduction

```powershell
$env:CI='true'
pnpm test
pnpm typecheck
pnpm lint
$env:TESTCONTAINERS_RYUK_DISABLED='true'
pnpm test:integration
pnpm test:e2e
pnpm test:web:e2e
pnpm build
pnpm audit --audit-level high
git diff --check
```
