# Workspace and Knowledge Workbench Evidence

Date: 2026-07-13  
Branch: `refactor/nestjs-ai-platform`

## Delivered Behavior

- PostgreSQL tables and TypeORM entities for Workspaces, memberships, and
  knowledge bases, with a reversible migration.
- Independent platform and Workspace roles with creator-as-owner transactions.
- Authenticated Workspace create/list and nested knowledge-base create/list API.
- Owner/admin create permission, member read-only permission, and tenant-hiding
  404 responses for outsiders.
- Case-insensitive knowledge-base uniqueness inside each Workspace.
- React Router Workspace URLs and TanStack Query cache keys scoped by Workspace.
- First-Workspace empty state, Workspace switcher, knowledge-base list and create
  flow, member read-only state, and accessible keyboard-contained create dialog.
- Explicit loading, empty, validation/conflict, 401 session expiry, 429, network,
  and 503 dependency states.
- No authentication or Workspace state is written to local storage.

## Automated Verification

- API unit: 11 suites, 63 tests passed.
- Web unit: 1 suite, 5 tests passed.
- API E2E: 2 suites, 21 tests passed.
- PostgreSQL/Redis integration: 5 suites, 12 tests passed.
- Playwright Chromium: 6 tests passed across 1440 x 900 desktop and 390 x 844
  mobile projects.
- Repository lint, strict TypeScript checks, API/Web production builds,
  `pnpm audit --audit-level high`, and `git diff --check` passed.
- Dependency audit reported no known vulnerabilities.

The migration integration test applies both migrations, checks enums, foreign
keys, normalization constraints and case-insensitive uniqueness, reverts both
migrations, and applies them again. The authorization integration test uses real
PostgreSQL and Redis containers and covers owner, admin, member, outsider,
duplicate-name, unauthenticated, and cross-Workspace isolation behavior.

Browser tests verify the Bearer header, Workspace URL switching, knowledge-base
creation, session restoration, login rendering, console errors/warnings, and
horizontal overflow. Business-workbench screenshots are stored in the
Playwright test output for both viewport projects.

## Reproduction

```powershell
$env:CI='true'
pnpm test
pnpm test:e2e
$env:TESTCONTAINERS_RYUK_DISABLED='true'
pnpm test:integration
pnpm test:web:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm audit --audit-level high
git diff --check
```

`TESTCONTAINERS_RYUK_DISABLED` is used because this workstation's Docker mirror
routes the Ryuk image through an unavailable local proxy. Every integration
suite still closes its application and stops its own containers in `afterAll`.

