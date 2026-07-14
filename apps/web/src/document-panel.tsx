import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from './api/auth-client';
import { documentClient } from './api/document-client';
import type { DocumentStatus, KnowledgeDocument } from './api/document-client';
import type { KnowledgeBase, WorkspaceSummary } from './api/workspace-client';
import './document-panel.css';

interface UploadItem { id: string; name: string; progress: number; state: 'uploading' | 'done' | 'failed'; error?: string }

export function DocumentPanel({ accessToken, workspace, knowledgeBase, onSessionExpired }: { accessToken: string; workspace: WorkspaceSummary; knowledgeBase: KnowledgeBase; onSessionExpired: () => void }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const canManage = workspace.role === 'owner' || workspace.role === 'admin';
  const queryKey = ['documents', workspace.id, knowledgeBase.id] as const;
  const documents = useQuery({
    queryKey,
    queryFn: () => documentClient.list(accessToken, workspace.id, knowledgeBase.id),
    refetchInterval: (query) => query.state.data?.some((item) => item.latestVersion.status === 'queued' || item.latestVersion.status === 'processing') ? 1_000 : false,
  });
  const detail = useQuery({
    queryKey: ['document', workspace.id, knowledgeBase.id, selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => documentClient.detail(accessToken, workspace.id, knowledgeBase.id, selectedId!),
    refetchInterval: (query) => {
      const status = query.state.data?.latestVersion.status;
      return status === 'queued' || status === 'processing' ? 1_000 : false;
    },
  });
  const retry = useMutation({
    mutationFn: ({ documentId, versionId }: { documentId: string; versionId: string }) => documentClient.retry(accessToken, workspace.id, knowledgeBase.id, documentId, versionId),
    onSuccess: async () => Promise.all([queryClient.invalidateQueries({ queryKey }), queryClient.invalidateQueries({ queryKey: ['document', workspace.id, knowledgeBase.id, selectedId] })]),
  });

  useEffect(() => {
    if ([documents.error, detail.error, retry.error].some((error) => error instanceof ApiError && error.status === 401)) onSessionExpired();
  }, [detail.error, documents.error, onSessionExpired, retry.error]);

  async function uploadFiles(files: FileList | null) {
    if (!files) return;
    await Promise.all(Array.from(files).map(async (file) => {
      const id = crypto.randomUUID();
      setUploads((items) => [...items, { id, name: file.name, progress: 0, state: 'uploading' }]);
      try {
        const document = await documentClient.upload(accessToken, workspace.id, knowledgeBase.id, file, (progress) => setUploads((items) => items.map((item) => item.id === id ? { ...item, progress } : item)));
        setUploads((items) => items.map((item) => item.id === id ? { ...item, progress: 100, state: 'done' } : item));
        setSelectedId(document.id);
        await queryClient.invalidateQueries({ queryKey });
      } catch (error) {
        setUploads((items) => items.map((item) => item.id === id ? { ...item, state: 'failed', error: uploadError(error) } : item));
      }
    }));
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <section className="document-section" aria-labelledby="documents-title">
      <div className="section-toolbar">
        <div><p className="section-kicker">DOCUMENT INGESTION</p><h2 id="documents-title">{knowledgeBase.name}</h2><p>文档上传、解析状态与版本记录</p></div>
        {canManage ? <><input ref={inputRef} className="visually-hidden" id="document-upload" type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown" onChange={(event) => void uploadFiles(event.target.files)} /><label className="primary-button content-button upload-label" htmlFor="document-upload"><UploadCloud size={17} aria-hidden="true" />上传文档</label></> : <span className="readonly-badge">只读成员</span>}
      </div>
      {uploads.length ? <ul className="upload-queue" aria-label="上传队列" aria-live="polite">{uploads.map((item) => <li key={item.id}><div><strong>{item.name}</strong><span>{item.state === 'uploading' ? `上传 ${item.progress}%` : item.state === 'done' ? '已进入解析队列' : item.error}</span></div><progress max="100" value={item.progress} aria-label={`${item.name} 上传进度`} /></li>)}</ul> : null}
      <div className="document-layout">
        <div className="document-list-wrap">
          {documents.isPending ? <p className="document-message" aria-busy="true">正在加载文档…</p> : null}
          {documents.isError ? <DocumentError retry={() => void documents.refetch()} /> : null}
          {!documents.isPending && !documents.isError && documents.data.length === 0 ? <div className="knowledge-empty" role="status"><FileText size={24} /><strong>暂无文档</strong><p>{canManage ? '上传 PDF、DOCX、TXT 或 Markdown，单文件不超过 25 MB。' : '等待管理员上传文档。'}</p></div> : null}
          {documents.data?.length ? <ul className="document-list">{documents.data.map((item) => <li key={item.id}><button type="button" className={selectedId === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}><span><strong>{item.fileName}</strong><small>v{item.latestVersion.versionNumber} · {formatBytes(item.latestVersion.sizeBytes)}</small></span><StatusBadge status={item.latestVersion.status} /></button></li>)}</ul> : null}
        </div>
        <DocumentDetail document={detail.data} loading={detail.isPending && Boolean(selectedId)} canManage={canManage} retrying={retry.isPending} onRetry={(documentId, versionId) => retry.mutate({ documentId, versionId })} />
      </div>
    </section>
  );
}

function DocumentDetail({ document, loading, canManage, retrying, onRetry }: { document?: KnowledgeDocument; loading: boolean; canManage: boolean; retrying: boolean; onRetry: (documentId: string, versionId: string) => void }) {
  if (loading) return <aside className="document-detail" aria-busy="true">正在加载详情…</aside>;
  if (!document) return <aside className="document-detail empty"><FileText size={24} /><p>选择文档查看版本与解析状态</p></aside>;
  return <aside className="document-detail"><header><p className="section-kicker">DOCUMENT DETAIL</p><h3>{document.fileName}</h3></header><ol className="version-list">{document.versions?.map((version) => <li key={version.id}><div><strong>版本 {version.versionNumber}</strong><StatusBadge status={version.status} /></div><dl><div><dt>大小</dt><dd>{formatBytes(version.sizeBytes)}</dd></div><div><dt>解析状态</dt><dd>{parseAttemptLabel(version.status, version.attemptCount)}</dd></div></dl>{version.errorMessage ? <p className="version-error" role="alert">{version.errorMessage}</p> : null}{canManage && version.status === 'failed' ? <button className="secondary-button retry-button" type="button" disabled={retrying} onClick={() => onRetry(document.id, version.id)}><RefreshCw size={15} />重新解析</button> : null}</li>)}</ol></aside>;
}

function StatusBadge({ status }: { status: DocumentStatus }) { const labels: Record<DocumentStatus, string> = { queued: '排队中', processing: '解析中', ready: '已就绪', failed: '失败' }; return <span className={`document-status ${status}`}>{labels[status]}</span>; }
function DocumentError({ retry }: { retry: () => void }) { return <div className="content-error" role="alert"><div><strong>无法加载文档</strong><p>服务暂时不可用，请稍后重试。</p></div><button className="secondary-button" type="button" onClick={retry}>重试</button></div>; }
function uploadError(error: unknown): string { if (!(error instanceof ApiError)) return '上传失败'; if (error.code === 'DOCUMENT_SIZE_INVALID') return '文件需小于 25 MB'; if (error.code === 'DOCUMENT_TYPE_UNSUPPORTED' || error.code === 'DOCUMENT_CONTENT_INVALID') return '文件类型或内容无效'; if (error.status === 403) return '当前角色无上传权限'; return '上传失败，请重试'; }
function formatBytes(value: number): string { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
function parseAttemptLabel(status: DocumentStatus, attemptCount: number): string {
  if (status === 'ready') return `解析成功 · 第 ${attemptCount} 次尝试`;
  if (status === 'processing') return `正在进行第 ${attemptCount} 次尝试`;
  if (status === 'queued') return attemptCount > 0 ? `等待第 ${attemptCount + 1} 次尝试` : '等待首次解析';
  return `已尝试 ${attemptCount} 次（最多 3 次）`;
}
