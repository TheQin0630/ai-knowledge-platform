# Frontend Authentication Evidence

Date: 2026-07-11
Branch: `refactor/nestjs-ai-platform`

## Delivered Behavior

- `apps/web` builds independently with React 19, Vite, and strict TypeScript.
- Initial load restores the HttpOnly refresh-cookie session through `/refresh` and obtains the current PostgreSQL-backed identity through `/me`.
- Login sends only email and password, retains the access token in memory, and does not write authentication state to localStorage.
- Logout calls the idempotent API endpoint, discards in-memory access state, and returns to login even if server revocation reports a dependency failure.
- Standardized credential, validation, rate-limit, network, and authentication-dependency errors receive separate sanitized Chinese messages.
- The authenticated screen is a responsive operational workbench rather than a marketing page.

## Automated Verification

- Vitest and Testing Library: 1 suite, 3 tests passed.
- Playwright Chromium: 4 tests passed across 1440 x 900 desktop and 390 x 844 mobile viewports.
- Browser checks covered anonymous login rendering, session restoration, Bearer authorization on `/me`, visible logout control, console problems, and horizontal overflow.
- Desktop and mobile screenshots were inspected for nonblank rendering, framing, text fit, overlap, and responsive layout.
- Frontend ESLint completed with zero warnings.
- Frontend strict TypeScript checking passed.
- Frontend production Vite build passed.

API responses in Playwright were intercepted using the active authentication contract. The obsolete API/container on port 18002 was not used as evidence.
