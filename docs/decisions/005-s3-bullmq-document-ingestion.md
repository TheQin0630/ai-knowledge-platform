# ADR-005: S3-backed, versioned document ingestion with BullMQ

Date: 2026-07-13  
Status: Accepted

## Context

Knowledge bases need durable source files, visible asynchronous parsing states, retry behavior, and immutable version history before retrieval or embeddings are introduced. Uploads are untrusted, queue delivery is at-least-once, and local development must preserve same-origin API behavior.

## Decision

- Store logical documents separately from immutable document versions.
- Treat a case-insensitive same-name upload in one knowledge base as a new version.
- Serialize version allocation by locking the parent knowledge base transaction.
- Store source bytes through the S3 API, using MinIO locally. Object keys contain Workspace, knowledge-base, document, and version IDs but never the original file name.
- Use the version UUID as the BullMQ job ID. Retained completed or failed jobs are removed before a manual retry so the same version can be re-enqueued.
- Run a bounded-concurrency worker in the NestJS process for this slice. Each job has three attempts and exponential backoff.
- Extract text from PDF with `pdf-parse`, DOCX with `mammoth`, and TXT/Markdown as UTF-8. Empty extraction is a failed parse; OCR, chunking, embeddings, and indexing are deferred.
- Expose metadata and errors but never source object keys or extracted text through the document API.
- Restrict upload and retry to Workspace OWNER/ADMIN while allowing MEMBER reads.

## Consequences

The API process currently hosts both HTTP and worker lifecycles, which is operationally simple but will need separation when ingestion throughput requires independent scaling. The database can temporarily contain a failed version when storage or queue submission fails; this is deliberate evidence for the user and enables diagnosis. Object cleanup and orphan reconciliation should be added before high-volume production rollout.
