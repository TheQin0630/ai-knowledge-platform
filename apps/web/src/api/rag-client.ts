import { apiRequest } from './auth-client';

export interface RagCitation {
  index: number;
  fileName: string;
  versionNumber: number;
  content: string;
  startOffset: number;
  endOffset: number;
}

export interface RagAnswer {
  conversationId: string;
  question: string;
  answer: string;
  model: string | null;
  retrievalMode: 'keyword' | 'hybrid';
  citations: RagCitation[];
  createdAt: string;
}
export interface ChatModelProvider { id: string; label: string; defaultModel: string }

export const ragClient = {
  models(accessToken: string, workspaceId: string, knowledgeBaseId: string): Promise<ChatModelProvider[]> {
    return apiRequest(`/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/answers/models`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  ask(accessToken: string, workspaceId: string, knowledgeBaseId: string, question: string,
    selection?: { provider?: string; model?: string }): Promise<RagAnswer> {
    return apiRequest(`/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/answers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, ...selection }),
    });
  },
};
