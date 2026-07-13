# Workspace and Knowledge Base API Contract

All endpoints use the `/api/v1` prefix and require an access token in the
`Authorization: Bearer <token>` header. The platform-level `UserRole` remains
separate from the role attached to a Workspace membership.

## Roles

| Workspace role | Read Workspace and knowledge bases | Create knowledge bases | Workspace ownership |
| --- | --- | --- | --- |
| `owner` | Yes | Yes | Yes |
| `admin` | Yes | Yes | No |
| `member` | Yes | No | No |

Users who are not members receive `WORKSPACE_NOT_FOUND` rather than a
permission response. This prevents an authenticated user from enumerating
Workspace identifiers. Platform administrators do not implicitly bypass this
membership boundary.

## Endpoints

### `GET /workspaces`

Returns only the caller's memberships:

```json
[
  {
    "id": "859ce7a0-4f96-4786-a9f6-3ec74c1d1477",
    "name": "Platform Engineering",
    "role": "owner",
    "knowledgeBaseCount": 2,
    "createdAt": "2026-07-13T00:00:00.000Z"
  }
]
```

### `POST /workspaces`

Request:

```json
{ "name": "Platform Engineering" }
```

The operation creates the Workspace and its `owner` membership in one
transaction. It does not create a personal Workspace during registration.

### `GET /workspaces/:workspaceId/knowledge-bases`

Any member may list knowledge bases in that Workspace. Results never include
knowledge bases from another Workspace.

### `POST /workspaces/:workspaceId/knowledge-bases`

Request:

```json
{
  "name": "Architecture",
  "description": "Validated technical decisions"
}
```

Only `owner` and `admin` may create. Names are unique within a Workspace using
case-insensitive comparison. The membership row is locked while the create
transaction runs so a concurrent role removal cannot pass a stale check.

## Stable Error Codes

| HTTP | Code | Meaning |
| --- | --- | --- |
| 401 | `INVALID_ACCESS_TOKEN` | Access token or server-side session is invalid |
| 403 | `WORKSPACE_PERMISSION_DENIED` | Membership exists but its role cannot perform the action |
| 404 | `WORKSPACE_NOT_FOUND` | Workspace is absent or hidden from this caller |
| 409 | `KNOWLEDGE_BASE_CONFLICT` | Case-insensitive name collision in the Workspace |
| 422 | `VALIDATION_ERROR` | Name or description failed the documented constraints |

