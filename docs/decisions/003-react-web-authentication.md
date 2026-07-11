# ADR-003: React Web Authentication Boundary

## Status

Accepted

## Date

2026-07-11

## Context

The platform needs an enterprise web interface over the existing NestJS authentication contract. The refresh credential is an HttpOnly, SameSite=Strict cookie scoped to `/api/v1/auth`; access tokens are short-lived and server-side sessions are revocable in Redis.

The first frontend slice must support login, refresh-based session restoration, current-user loading, and logout without weakening those boundaries. It must also remain independently buildable and testable inside the pnpm workspace.

## Decision

Use React 19, strict TypeScript, and Vite in `apps/web`.

- Keep the access token only in React memory. Do not write it to localStorage, sessionStorage, cookies, or URLs.
- Restore a browser session with `POST /api/v1/auth/refresh`, then load the authoritative identity with authenticated `GET /api/v1/auth/me`.
- Send every authentication request with `credentials: include` while never reading the HttpOnly refresh cookie in JavaScript.
- Treat the expected no-session 401 as anonymous state. Present 429 retry timing and sanitized 503 dependency failures as distinct user states.
- Use a same-origin `/api` development proxy to the default NestJS port 3000. Do not introduce cross-origin cookie or CORS behavior.
- Use Vitest and Testing Library for state behavior, and Playwright with mocked contract responses for desktop and mobile browser verification.
- Introduce routing, server-state caching, or global state libraries only when a concrete feature requires them.

## Alternatives Considered

### Persist the access token in localStorage

Rejected because persistent JavaScript-readable bearer tokens increase the impact of an XSS compromise and are unnecessary when the refresh cookie can restore state.

### Put the access token in another JavaScript cookie

Rejected because it creates another ambient credential and does not improve on in-memory bearer handling.

### Use Next.js

Rejected for the current application because server rendering is not required for the private operational workspace, while Vite keeps the deployment and authentication boundary smaller.

### Run the frontend cross-origin in development

Rejected because it would require CORS and cookie policy changes before the product has a CSRF design for cross-site use.

## Consequences

- A full page reload requires one refresh rotation followed by `/me` before protected content renders.
- React development effects must not trigger duplicate refresh rotations; the application guards the restoration effect per mount.
- The browser may report the expected anonymous refresh 401 as a failed resource. Browser tests allow only that exact event on the login path and fail on additional console errors or warnings.
- Future protected API calls must reuse the in-memory access state and add single-flight refresh handling before automatic 401 retry is introduced.
