import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentClient } from './api/document-client';
import { DocumentPanel } from './document-panel';

vi.mock('./api/document-client', async (loadOriginal) => {
  const original = await loadOriginal<typeof import('./api/document-client')>();
  return { ...original, documentClient: { list: vi.fn(), detail: vi.fn(), retry: vi.fn(), upload: vi.fn() } };
});

const workspace = { id: 'workspace-1', name: 'Platform', role: 'member' as const, knowledgeBaseCount: 1, createdAt: '2026-01-01T00:00:00Z' };
const knowledgeBase = { id: 'knowledge-base-1', workspaceId: workspace.id, name: 'Runbooks', description: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const version = { id: 'version-1', versionNumber: 1, mediaType: 'text/markdown', sizeBytes: 2048, status: 'failed' as const, attemptCount: 3, errorCode: 'DOCUMENT_PARSE_FAILED', errorMessage: 'No text', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const document = { id: 'document-1', knowledgeBaseId: knowledgeBase.id, fileName: 'incident.md', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', latestVersion: version };

describe('DocumentPanel', () => {
  beforeEach(() => {
    vi.mocked(documentClient).list.mockResolvedValue([document]);
    vi.mocked(documentClient).detail.mockResolvedValue({ ...document, versions: [version] });
  });
  it('shows failure detail to a read-only member without management actions', async () => {
    renderPanel('member');
    await userEvent.click(await screen.findByRole('button', { name: /incident.md/ }));
    expect(await screen.findByText('No text')).toBeInTheDocument();
    expect(screen.getByText('只读成员')).toBeInTheDocument();
    expect(screen.queryByLabelText('上传文档')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新解析' })).not.toBeInTheDocument();
  });
  it('allows an owner to retry a failed version', async () => {
    vi.mocked(documentClient).retry.mockResolvedValue({ ...version, status: 'queued' });
    renderPanel('owner');
    await userEvent.click(await screen.findByRole('button', { name: /incident.md/ }));
    await userEvent.click(await screen.findByRole('button', { name: '重新解析' }));
    expect(vi.mocked(documentClient).retry.mock.calls[0]).toEqual([
      'token',
      workspace.id,
      knowledgeBase.id,
      document.id,
      version.id,
    ]);
  });
});

function renderPanel(role: 'owner' | 'member') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><DocumentPanel accessToken="token" workspace={{ ...workspace, role }} knowledgeBase={knowledgeBase} onSessionExpired={vi.fn()} /></QueryClientProvider>);
}
