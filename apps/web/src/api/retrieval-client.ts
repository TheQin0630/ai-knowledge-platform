import { apiRequest } from './auth-client';

export interface RetrievalHit {
  chunkId: string;
  content: string;
  startOffset: number;
  endOffset: number;
  documentId: string;
  fileName: string;
  versionNumber: number;
  score: number;
  keywordRank: number | null;
  vectorRank: number | null;
}

export interface RetrievalResponse {
  query: string;
  mode: 'keyword' | 'hybrid';
  results: RetrievalHit[];
}

export const retrievalClient = {
  search(
    accessToken: string,
    workspaceId: string,
    knowledgeBaseId: string,
    query: string,
  ): Promise<RetrievalResponse> {
    return apiRequest(
      `/api/v1/workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/search`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit: 10 }),
      },
    );
  },
};
