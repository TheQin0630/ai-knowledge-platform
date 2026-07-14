import { apiRequest } from './auth-client';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  knowledgeBaseCount: number;
  createdAt: string;
}

export interface KnowledgeBase {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export const workspaceClient = {
  listWorkspaces(accessToken: string): Promise<WorkspaceSummary[]> {
    return authorizedRequest('/api/v1/workspaces', accessToken);
  },

  createWorkspace(
    accessToken: string,
    input: { name: string },
  ): Promise<WorkspaceSummary> {
    return authorizedRequest('/api/v1/workspaces', accessToken, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  deleteWorkspace(accessToken: string, workspaceId: string, confirmName: string): Promise<void> {
    return authorizedRequest(`/api/v1/workspaces/${workspaceId}`, accessToken, {
      method: 'DELETE', body: JSON.stringify({ confirmName }),
    });
  },

  listKnowledgeBases(
    accessToken: string,
    workspaceId: string,
  ): Promise<KnowledgeBase[]> {
    return authorizedRequest(
      `/api/v1/workspaces/${workspaceId}/knowledge-bases`,
      accessToken,
    );
  },

  createKnowledgeBase(
    accessToken: string,
    workspaceId: string,
    input: { name: string; description?: string },
  ): Promise<KnowledgeBase> {
    return authorizedRequest(
      `/api/v1/workspaces/${workspaceId}/knowledge-bases`,
      accessToken,
      { method: 'POST', body: JSON.stringify(input) },
    );
  },
  deleteKnowledgeBase(accessToken: string, workspaceId: string, knowledgeBaseId: string,
    confirmName: string): Promise<void> {
    return authorizedRequest(`/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}`, accessToken, {
      method: 'DELETE', body: JSON.stringify({ confirmName }),
    });
  },
};

function authorizedRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  return apiRequest<T>(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });
}
