import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ragClient } from './api/rag-client';
import { RagPanel } from './rag-panel';

vi.mock('./api/rag-client', () => ({ ragClient: { ask: vi.fn(), models: vi.fn() } }));

describe('RagPanel', () => {
  it('renders an answer with verifiable citations', async () => {
    vi.mocked(ragClient).models.mockResolvedValue([
      { id: 'glm', label: 'GLM', defaultModel: 'glm-4-flash' },
    ]);
    vi.mocked(ragClient).ask.mockResolvedValue({
      conversationId: 'conversation',
      question: '如何回滚？',
      answer: '按回滚手册执行。',
      model: 'test-model',
      retrievalMode: 'hybrid',
      createdAt: new Date().toISOString(),
      citations: [{ index: 1, fileName: '运维手册.md', versionNumber: 2,
        content: '执行回滚脚本。', startOffset: 0, endOffset: 8 }],
    });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><RagPanel accessToken="token"
      workspaceId="workspace" knowledgeBaseId="knowledge" onSessionExpired={vi.fn()} /></QueryClientProvider>);

    await userEvent.type(screen.getByLabelText('你的问题'), '如何回滚？');
    await userEvent.click(screen.getByRole('button', { name: '提问' }));

    expect(await screen.findByText('按回滚手册执行。')).toBeInTheDocument();
    expect(screen.getByText('[1] 运维手册.md · 版本 2')).toBeInTheDocument();
  });
});
