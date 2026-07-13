# Document Ingestion API Contract

All routes require an access-token Bearer header and are scoped to a Workspace and knowledge base.

Base path: `/api/v1/workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/documents`

## Upload

`POST /` accepts `multipart/form-data` with one `file` field. OWNER and ADMIN may upload; MEMBER is read-only. Supported extensions are PDF, DOCX, TXT, MD and MARKDOWN. Files must contain 1 byte to 25 MB. PDF and DOCX signatures and plain-text binary content are checked before storage.

The response is a logical document with `latestVersion`. A case-insensitive file-name match inside one knowledge base creates the next immutable version. A new name creates a new logical document. Initial status is `queued`.

## List and Detail

- `GET /` returns documents with their latest version.
- `GET /:documentId` returns one document and all versions in descending order.

Any Workspace member may read. An outsider receives tenant-hiding 404 semantics.

Version states are `queued`, `processing`, `ready`, and `failed`. Public responses never include extracted text or S3 object keys.

## Retry

`POST /:documentId/versions/:versionId/retry` is restricted to OWNER and ADMIN and only accepts a `failed` version. Automatic BullMQ processing attempts each version three times with exponential backoff. Manual retry resets the terminal error and reuses the immutable source object.

## Stable Errors

- `DOCUMENT_FILE_REQUIRED`
- `DOCUMENT_SIZE_INVALID`
- `DOCUMENT_TYPE_UNSUPPORTED`
- `DOCUMENT_CONTENT_INVALID`
- `DOCUMENT_NAME_INVALID`
- `DOCUMENT_NOT_FOUND`
- `DOCUMENT_RETRY_NOT_ALLOWED`
- `DOCUMENT_INGESTION_UNAVAILABLE`
- `DOCUMENT_QUEUE_UNAVAILABLE`
- existing `WORKSPACE_NOT_FOUND`, `WORKSPACE_PERMISSION_DENIED`, and `KNOWLEDGE_BASE_NOT_FOUND`
