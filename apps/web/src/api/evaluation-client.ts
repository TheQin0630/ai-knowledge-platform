import { apiRequest } from './auth-client';

export interface EvaluationRun {
  id: string; name: string; retrievalVersion: string; model: string | null; caseCount: number;
  keywordCoverage: number | string; citationCoverage: number | string; groundedRate: number | string; createdAt: string;
}

export const evaluationClient = {
  list(token: string, workspaceId: string, knowledgeBaseId: string): Promise<EvaluationRun[]> {
    return apiRequest(`/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/evaluations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  run(token: string, workspaceId: string, knowledgeBaseId: string, input: {
    name: string; cases: Array<{ question: string; expectedKeywords: string[]; expectedFiles: string[] }>;
  }): Promise<EvaluationRun> {
    return apiRequest(`/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/evaluations`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    });
  },
  delete(token: string, workspaceId: string, knowledgeBaseId: string, evaluationId: string, confirmName: string): Promise<void> {
    return apiRequest(`/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/evaluations/${evaluationId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ confirmName }),
    });
  },
};
