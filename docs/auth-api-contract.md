# Authentication API Contract

Status: Active
Date: 2026-07-10
Base path: `/api/v1/auth`

## Trust Boundaries

- HTTP bodies, headers, and cookies are untrusted.
- PostgreSQL owns durable user identity and role state.
- Redis owns revocable session and refresh-token rotation state.
- JWT claims are untrusted until signature, algorithm, issuer, audience, expiry, purpose, and session state all pass.
- Public requests never choose a role; registration always creates `user`.

## Endpoints

### `POST /register`

Request:

```json
{
  "email": "user@example.com",
  "password": "at-least-12-characters"
}
```

Only `email` and `password` are accepted. Unknown fields, including `role`, are rejected.

Response: `201 Created`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "user",
  "createdAt": "2026-07-10T00:00:00.000Z"
}
```

Duplicate normalized identity returns `409 IDENTITY_CONFLICT` without disclosing an existing account's state.

### `POST /login`

Request fields are `email` and `password`. Invalid credentials always return the same `401 INVALID_CREDENTIALS` response.

Response: `200 OK`

```json
{
  "accessToken": "jwt",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user"
  }
}
```

The response also sets a rotated `refresh_token` cookie.

### `POST /refresh`

The refresh token is read only from the cookie. A valid request atomically rotates the refresh-token digest in Redis and returns a new access token plus a replacement refresh cookie.

Missing, expired, forged, wrong-purpose, session-mismatched, or replayed refresh tokens return `401 INVALID_REFRESH_TOKEN`. Replay detection revokes the affected session.

### `POST /logout`

Logout is idempotent, deletes the server-side session when a valid refresh token identifies it, clears the refresh cookie, and returns `204 No Content`.

### `GET /me`

Requires an access Bearer token and an active matching Redis session. Returns the current public identity. Access tokens cannot be used as refresh tokens, and refresh tokens cannot authorize this endpoint.

## Token Contract

Required claims:

| Claim | Meaning |
| --- | --- |
| `sub` | user UUID |
| `sid` | server-side session UUID |
| `jti` | unique token UUID |
| `purpose` | exactly `access` or `refresh` |
| `role` | role at issuance; protected operations still check current authorization policy |
| `iss` | `ai-knowledge-platform` |
| `aud` | `ai-knowledge-api` |
| `iat` / `exp` | issued and expiry timestamps |

Access and refresh tokens use separate secrets. Verification accepts only `HS256` and the expected purpose.

## Cookie Contract

`refresh_token` attributes:

- `HttpOnly=true`
- `SameSite=Strict`
- `Secure=true` in production
- `Path=/api/v1/auth`
- `Max-Age=604800` seconds

Same-origin deployment is assumed. Any future cross-site frontend requires an explicit CSRF design before relaxing `SameSite`.

## Validation and Errors

- Email is trimmed, lowercased, format-validated, and limited to 320 characters.
- Password length is 12-128 characters to balance security and hashing resource bounds.
- Passwords are hashed with Argon2id using at least 19 MiB memory, 2 iterations, and parallelism 1.
- Every error uses `{ "error": { "code": "...", "message": "..." } }`.
- Validation errors never echo passwords, tokens, hashes, database errors, or Redis errors.

## Session State

Redis key: `auth:session:{sid}` with a seven-day TTL.

Stored fields are limited to user ID, refresh-token SHA-256 digest, and absolute expiry. Raw refresh tokens and passwords are never stored or logged.

## Official Sources

- NestJS authentication: https://docs.nestjs.com/security/authentication
- NestJS validation: https://docs.nestjs.com/techniques/validation
- NestJS cookies: https://docs.nestjs.com/techniques/cookies
- NestJS JWT: https://github.com/nestjs/jwt
- node-rs Argon2: https://github.com/napi-rs/node-rs/tree/main/packages/argon2
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- ioredis: https://github.com/redis/ioredis
