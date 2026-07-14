import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { retrievalClient } from './api/retrieval-client';
import { RetrievalPanel } from './retrieval-panel';

vi.mock('./api/retrieval-client', () => ({
  retrievalClient: { search: vi.fn() },
}));

describe('RetrievalPanel', () => {
  it('shows ranked source chunks and the active retrieval mode', async () => {
    vi.mocked(retrievalClient).search.mockResolvedValue({
      query: '部署流程',
      mode: 'keyword',
      results: [
        {
          chunkId: 'chunk-1',
          content: '生产环境部署流程与回滚步骤。',
          startOffset: 0,
          endOffset: 15,
          documentId: 'document-1',
          fileName: '运维手册.md',
          versionNumber: 2,
          score: 0.016,
          keywordRank: 1,
          vectorRank: null,
        },
      ],
    });
    renderPanel();

    await userEvent.type(screen.getByLabelText('检索问题'), '部署流程');
    await userEvent.click(screen.getByRole('button', { name: '开始检索' }));

    expect(await screen.findByText('关键词检索')).toBeInTheDocument();
    expect(screen.getByText('生产环境部署流程与回滚步骤。')).toBeInTheDocument();
    expect(screen.getByText('运维手册.md · 版本 2')).toBeInTheDocument();
  });
});

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RetrievalPanel
        accessToken="token"
        workspaceId="workspace-1"
        knowledgeBaseId="knowledge-base-1"
        onSessionExpired={vi.fn()}
      />
    </QueryClientProvider>,
  );
}
