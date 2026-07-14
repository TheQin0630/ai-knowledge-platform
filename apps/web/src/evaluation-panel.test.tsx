import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { evaluationClient } from './api/evaluation-client';
import { EvaluationPanel } from './evaluation-panel';

vi.mock('./api/evaluation-client', () => ({ evaluationClient: { list: vi.fn(), run: vi.fn() } }));

describe('EvaluationPanel', () => {
  it('shows comparable quality metrics from historical runs', async () => {
    vi.mocked(evaluationClient).list.mockResolvedValue([{ id: 'run', name: '基线', retrievalVersion: 'rrf-v1',
      model: 'model', caseCount: 5, keywordCoverage: 0.8, citationCoverage: 0.6, groundedRate: 1, createdAt: '2026-07-14' }]);
    render(<QueryClientProvider client={new QueryClient()}><EvaluationPanel accessToken="token" workspaceId="workspace"
      knowledgeBaseId="knowledge" onSessionExpired={vi.fn()} /></QueryClientProvider>);
    expect(await screen.findByText('基线')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
