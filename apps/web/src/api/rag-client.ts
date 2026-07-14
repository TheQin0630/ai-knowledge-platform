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

export const ragClient = {
  ask(accessToken: string, workspaceId: string, knowledgeBaseId: string, question: string): Promise<RagAnswer> {
    return apiRequest(`/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/answers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
  },
};
