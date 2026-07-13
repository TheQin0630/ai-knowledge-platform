import { ApiError, apiRequest } from './auth-client';

export type DocumentStatus = 'queued' | 'processing' | 'ready' | 'failed';

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  mediaType: string;
  sizeBytes: number;
  status: DocumentStatus;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  latestVersion: DocumentVersion;
  versions?: DocumentVersion[];
}

function basePath(workspaceId: string, knowledgeBaseId: string): string {
  return `/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/documents`;
}

export const documentClient = {
  list(accessToken: string, workspaceId: string, knowledgeBaseId: string) {
    return authorizedRequest<KnowledgeDocument[]>(basePath(workspaceId, knowledgeBaseId), accessToken);
  },
  detail(accessToken: string, workspaceId: string, knowledgeBaseId: string, documentId: string) {
    return authorizedRequest<KnowledgeDocument>(`${basePath(workspaceId, knowledgeBaseId)}/${documentId}`, accessToken);
  },
  retry(accessToken: string, workspaceId: string, knowledgeBaseId: string, documentId: string, versionId: string) {
    return authorizedRequest<DocumentVersion>(`${basePath(workspaceId, knowledgeBaseId)}/${documentId}/versions/${versionId}/retry`, accessToken, { method: 'POST' });
  },
  upload(accessToken: string, workspaceId: string, knowledgeBaseId: string, file: File, onProgress: (percent: number) => void): Promise<KnowledgeDocument> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', basePath(workspaceId, knowledgeBaseId));
      request.withCredentials = true;
      request.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () => {
        const payload = parsePayload(request.responseText);
        if (request.status >= 200 && request.status < 300 && payload) {
          resolve(payload as KnowledgeDocument);
          return;
        }
        reject(new ApiError(request.status, readErrorCode(payload)));
      });
      request.addEventListener('error', () => reject(new ApiError(0, 'NETWORK_UNAVAILABLE')));
      const body = new FormData();
      body.append('file', file);
      request.send(body);
    });
  },
};

function authorizedRequest<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  return apiRequest<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
}

function parsePayload(value: string): unknown {
  try { return JSON.parse(value) as unknown; } catch { return undefined; }
}

function readErrorCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'REQUEST_FAILED';
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object') return 'REQUEST_FAILED';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'REQUEST_FAILED';
}
