import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenText,
  BarChart3,
  Bot,
  ChevronDown,
  CircleUserRound,
  Database,
  Gauge,
  FileText,
  Library,
  LogOut,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from './api/auth-client';
import type { CurrentUser } from './api/auth-client';
import { workspaceClient } from './api/workspace-client';
import type {
  KnowledgeBase,
  WorkspaceRole,
  WorkspaceSummary,
} from './api/workspace-client';
import { DocumentPanel } from './document-panel';
import { RetrievalPanel } from './retrieval-panel';
import { RagPanel } from './rag-panel';
import { EvaluationPanel } from './evaluation-panel';
import { ConfirmDeleteDialog } from './confirm-delete-dialog';
import './workbench-modern.css';

interface WorkspaceWorkbenchProps {
  accessToken: string;
  user: CurrentUser;
  onLogout: () => Promise<void>;
  onSessionExpired: () => void;
}

export function WorkspaceWorkbench({
  accessToken,
  user,
  onLogout,
  onSessionExpired,
}: WorkspaceWorkbenchProps) {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [workspaceFormOpen, setWorkspaceFormOpen] = useState(false);
  const [knowledgeBaseFormOpen, setKnowledgeBaseFormOpen] = useState(false);
  const [selectedKnowledgeBaseId, setSelectedKnowledgeBaseId] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'workspace' | 'knowledgeBase'; id: string; name: string }>();

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspaceClient.listWorkspaces(accessToken),
  });
  const selectedWorkspace = workspacesQuery.data?.find(
    (workspace) => workspace.id === workspaceId,
  );
  const knowledgeBasesQuery = useQuery({
    queryKey: ['knowledge-bases', selectedWorkspace?.id],
    enabled: Boolean(selectedWorkspace),
    queryFn: () =>
      selectedWorkspace
        ? workspaceClient.listKnowledgeBases(accessToken, selectedWorkspace.id)
        : Promise.resolve([]),
  });
  const selectedKnowledgeBase = knowledgeBasesQuery.data?.find(
    (item) => item.id === selectedKnowledgeBaseId,
  );

  useEffect(() => {
    setSelectedKnowledgeBaseId(undefined);
  }, [selectedWorkspace?.id]);

  useEffect(() => {
    if (isSessionExpired(workspacesQuery.error) || isSessionExpired(knowledgeBasesQuery.error)) {
      onSessionExpired();
    }
  }, [knowledgeBasesQuery.error, onSessionExpired, workspacesQuery.error]);

  useEffect(() => {
    const workspaces = workspacesQuery.data;
    const firstWorkspace = workspaces?.[0];
    if (!firstWorkspace) return;
    if (!workspaceId || !workspaces.some((workspace) => workspace.id === workspaceId)) {
      void navigate(`/workspaces/${firstWorkspace.id}`, { replace: true });
    }
  }, [navigate, workspaceId, workspacesQuery.data]);

  const createWorkspace = useMutation({
    mutationFn: (name: string) =>
      workspaceClient.createWorkspace(accessToken, { name }),
    onSuccess: (workspace) => {
      queryClient.setQueryData<WorkspaceSummary[]>(['workspaces'], (current = []) => [
        ...current,
        workspace,
      ]);
      setWorkspaceFormOpen(false);
      void navigate(`/workspaces/${workspace.id}`);
    },
  });
  const createKnowledgeBase = useMutation({
    mutationFn: (input: { name: string; description?: string }) => {
      if (!selectedWorkspace) throw new Error('Workspace is required');
      return workspaceClient.createKnowledgeBase(
        accessToken,
        selectedWorkspace.id,
        input,
      );
    },
    onSuccess: async () => {
      setKnowledgeBaseFormOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['knowledge-bases', selectedWorkspace?.id],
        }),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      ]);
    },
  });
  const removeResource = useMutation({ mutationFn: async (target: { type: 'workspace' | 'knowledgeBase'; id: string; name: string }) => {
    if (target.type === 'workspace') return workspaceClient.deleteWorkspace(accessToken, target.id, target.name);
    if (!selectedWorkspace) throw new Error('Workspace is required');
    return workspaceClient.deleteKnowledgeBase(accessToken, selectedWorkspace.id, target.id, target.name);
  }, onSuccess: async (_, target) => {
    setDeleteTarget(undefined);
    if (target.type === 'workspace') { await queryClient.invalidateQueries({ queryKey: ['workspaces'] }); void navigate('/'); }
    else { setSelectedKnowledgeBaseId(undefined); await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases', selectedWorkspace?.id] }),
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
    ]); }
  } });

  return (
    <div className="app-shell">
      <Sidebar user={user} hasKnowledgeBase={Boolean(selectedKnowledgeBase)} />
      <div className="workspace-shell">
        <Topbar
          workspaces={workspacesQuery.data ?? []}
          selectedWorkspace={selectedWorkspace}
          loggingOut={loggingOut}
          onSelect={(id) => void navigate(`/workspaces/${id}`)}
          onCreate={() => setWorkspaceFormOpen(true)}
          onLogout={() => {
            setLoggingOut(true);
            void onLogout();
          }}
        />
        <main className="workspace" id="overview">
          <header className="page-header">
            <div>
              <p className="eyebrow">WORKSPACE</p>
              <h1>{selectedWorkspace?.name ?? '知识工作台'}</h1>
              <p>{workspaceSubtitle(workspacesQuery, selectedWorkspace)}</p>
            </div>
            {selectedWorkspace ? (
              <div className="page-actions"><div className="identity-chip">
                <CircleUserRound size={18} aria-hidden="true" />
                <span>{workspaceRoleLabel(selectedWorkspace.role)}</span>
              </div>{selectedWorkspace.role === 'owner' ? <button className="icon-danger" aria-label={`删除 Workspace ${selectedWorkspace.name}`}
                onClick={() => setDeleteTarget({ type: 'workspace', id: selectedWorkspace.id, name: selectedWorkspace.name })}><Trash2 size={17} /></button> : null}</div>
            ) : null}
          </header>

          {workspacesQuery.isPending ? (
            <LoadingPanel label="正在加载 Workspace" />
          ) : workspacesQuery.isError ? (
            <ErrorPanel error={workspacesQuery.error} retry={() => void workspacesQuery.refetch()} />
          ) : workspacesQuery.data.length === 0 ? (
            <WorkspaceEmpty onCreate={() => setWorkspaceFormOpen(true)} />
          ) : selectedWorkspace ? (
            <KnowledgeBasePanel
              workspace={selectedWorkspace}
              items={knowledgeBasesQuery.data ?? []}
              loading={knowledgeBasesQuery.isPending}
              error={knowledgeBasesQuery.error}
              onRetry={() => void knowledgeBasesQuery.refetch()}
              onCreate={() => setKnowledgeBaseFormOpen(true)}
              selectedId={selectedKnowledgeBaseId}
              onSelect={setSelectedKnowledgeBaseId}
              onDelete={(item) => setDeleteTarget({ type: 'knowledgeBase', id: item.id, name: item.name })}
            />
          ) : (
            <LoadingPanel label="正在切换 Workspace" />
          )}
          {selectedWorkspace && selectedKnowledgeBase ? (
            <>
              <CollapsibleModule id="documents" title="文档与解析" icon={<FileText size={17} />}><DocumentPanel
                accessToken={accessToken}
                workspace={selectedWorkspace}
                knowledgeBase={selectedKnowledgeBase}
                onSessionExpired={onSessionExpired}
              /></CollapsibleModule>
              <CollapsibleModule id="retrieval" title="检索调试" icon={<Search size={17} />}><RetrievalPanel
                accessToken={accessToken}
                workspaceId={selectedWorkspace.id}
                knowledgeBaseId={selectedKnowledgeBase.id}
                onSessionExpired={onSessionExpired}
              /></CollapsibleModule>
              <CollapsibleModule id="answers" title="知识库问答" icon={<Bot size={17} />}><RagPanel
                accessToken={accessToken}
                workspaceId={selectedWorkspace.id}
                knowledgeBaseId={selectedKnowledgeBase.id}
                onSessionExpired={onSessionExpired}
              /></CollapsibleModule>
              <CollapsibleModule id="evaluations" title="效果评测" icon={<BarChart3 size={17} />}><EvaluationPanel
                accessToken={accessToken}
                workspaceId={selectedWorkspace.id}
                knowledgeBaseId={selectedKnowledgeBase.id}
                onSessionExpired={onSessionExpired}
              /></CollapsibleModule>
            </>
          ) : null}
        </main>
      </div>

      {workspaceFormOpen ? (
        <CreateDialog
          title="新建 Workspace"
          description="为一个团队或业务边界创建独立的知识空间。"
          nameLabel="Workspace 名称"
          pending={createWorkspace.isPending}
          error={createWorkspace.error}
          onClose={() => setWorkspaceFormOpen(false)}
          onSubmit={(name) => createWorkspace.mutate(name)}
        />
      ) : null}
      {knowledgeBaseFormOpen ? (
        <CreateDialog
          title="新建知识库"
          description={`知识库将归属 ${selectedWorkspace?.name ?? '当前 Workspace'}。`}
          nameLabel="知识库名称"
          descriptionEnabled
          pending={createKnowledgeBase.isPending}
          error={createKnowledgeBase.error}
          onClose={() => setKnowledgeBaseFormOpen(false)}
          onSubmit={(name, description) =>
            createKnowledgeBase.mutate({ name, ...(description ? { description } : {}) })
          }
        />
      ) : null}
      {deleteTarget ? <ConfirmDeleteDialog resourceLabel={deleteTarget.type === 'workspace' ? 'Workspace' : '知识库'}
        resourceName={deleteTarget.name} pending={removeResource.isPending}
        error={removeResource.error instanceof ApiError && removeResource.error.code === 'WORKSPACE_NOT_EMPTY'
          ? 'Workspace 非空，请先删除其中的知识库。' : removeResource.isError ? '删除失败，请重试。' : undefined}
        onClose={() => setDeleteTarget(undefined)} onConfirm={(name) => removeResource.mutate({ ...deleteTarget, name })} /> : null}
    </div>
  );
}

function Sidebar({ user, hasKnowledgeBase }: { user: CurrentUser; hasKnowledgeBase: boolean }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true"><Library size={20} /></span>
        <span>KNOWLEDGE OS</span>
      </div>
      <nav className="primary-nav" aria-label="主导航">
        <a className="nav-item active" href="#overview" aria-current="page">
          <Gauge size={18} aria-hidden="true" />工作台
        </a>
        <a className="nav-item" href="#knowledge-bases">
          <BookOpenText size={18} aria-hidden="true" />知识库
        </a>
        {hasKnowledgeBase ? <>
          <a className="nav-item" href="#documents"><FileText size={18} />文档</a>
          <a className="nav-item" href="#retrieval"><Search size={18} />检索</a>
          <a className="nav-item" href="#answers"><Bot size={18} />问答</a>
          <a className="nav-item" href="#evaluations"><BarChart3 size={18} />评测</a>
        </> : null}
      </nav>
      <div className="sidebar-account">
        <span className="avatar" aria-hidden="true">{user.email.charAt(0).toUpperCase()}</span>
        <span className="account-copy">
          <strong>{user.email}</strong>
          <small>{user.role === 'admin' ? '平台管理员' : '平台成员'}</small>
        </span>
      </div>
    </aside>
  );
}

function Topbar({
  workspaces,
  selectedWorkspace,
  loggingOut,
  onSelect,
  onCreate,
  onLogout,
}: {
  workspaces: WorkspaceSummary[];
  selectedWorkspace?: WorkspaceSummary;
  loggingOut: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="topbar">
      <span className="mobile-top-brand" aria-label="Knowledge OS"><Library size={18} /></span>
      <div className="workspace-switcher">
        <label htmlFor="workspace-select">Workspace</label>
        <select
          id="workspace-select"
          value={selectedWorkspace?.id ?? ''}
          disabled={workspaces.length === 0}
          onChange={(event) => onSelect(event.target.value)}
        >
          {workspaces.length === 0 ? <option value="">尚未创建</option> : null}
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
          ))}
        </select>
        <button className="compact-button" type="button" onClick={onCreate}>
          <Plus size={15} aria-hidden="true" />新建
        </button>
      </div>
      <div className="topbar-actions">
        <span className="system-badge"><span className="status-dot" />会话已保护</span>
        <button
          className="icon-button"
          type="button"
          aria-label="退出登录"
          title="退出登录"
          disabled={loggingOut}
          onClick={onLogout}
        ><LogOut size={18} /></button>
      </div>
    </header>
  );
}

function WorkspaceEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="empty-state-panel" aria-labelledby="workspace-empty-title">
      <span className="empty-state-icon" aria-hidden="true"><Database size={24} /></span>
      <p className="section-kicker">START HERE</p>
      <h2 id="workspace-empty-title">创建第一个 Workspace</h2>
      <p>Workspace 隔离成员、角色和知识库数据。创建后你将成为 Owner。</p>
      <button className="primary-button content-button" type="button" onClick={onCreate}>
        <Plus size={17} />创建 Workspace
      </button>
    </section>
  );
}

function KnowledgeBasePanel({
  workspace,
  items,
  loading,
  error,
  onRetry,
  onCreate,
  selectedId,
  onSelect,
  onDelete,
}: {
  workspace: WorkspaceSummary;
  items: KnowledgeBase[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onCreate: () => void;
  selectedId?: string;
  onSelect: (id: string) => void;
  onDelete: (item: KnowledgeBase) => void;
}) {
  const canCreate = workspace.role === 'owner' || workspace.role === 'admin';
  return (
    <section className="knowledge-section" id="knowledge-bases" aria-labelledby="knowledge-title">
      <div className="section-toolbar">
        <div>
          <p className="section-kicker">KNOWLEDGE BASES</p>
          <h2 id="knowledge-title">知识库</h2>
          <p>{workspace.knowledgeBaseCount} 个知识库</p>
        </div>
        {canCreate ? (
          <button className="primary-button content-button" type="button" onClick={onCreate}>
            <Plus size={17} />新建知识库
          </button>
        ) : <span className="readonly-badge">只读成员</span>}
      </div>
      {loading ? <LoadingPanel label="正在加载知识库" compact /> : null}
      {error ? <ErrorPanel error={error} retry={onRetry} /> : null}
      {!loading && !error && items.length === 0 ? (
        <div className="knowledge-empty" role="status">
          <BookOpenText size={24} aria-hidden="true" />
          <strong>暂无知识库</strong>
          <p>{canCreate ? '创建知识库后即可上传和组织文档。' : '等待 Workspace 管理员创建知识库。'}</p>
        </div>
      ) : null}
      {items.length > 0 ? (
        <ul className="knowledge-list">
          {items.map((item) => (
            <li key={item.id} className={selectedId === item.id ? 'selected' : ''}>
              <button type="button" onClick={() => onSelect(item.id)} aria-pressed={selectedId === item.id}>
                <span className="knowledge-icon" aria-hidden="true"><BookOpenText size={19} /></span>
                <span className="knowledge-copy"><strong>{item.name}</strong><small>{item.description ?? '尚未添加描述'}</small></span>
                <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time>
              </button>
              {canCreate ? <button type="button" className="knowledge-delete" aria-label={`删除知识库 ${item.name}`}
                onClick={() => onDelete(item)}><Trash2 size={15} /></button> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CollapsibleModule({ id, title, icon, children }: { id: string; title: string; icon: ReactNode; children: ReactNode }) {
  return <details className="workbench-module" id={id} open><summary>{icon}<span>{title}</span><ChevronDown size={18} /></summary>
    <div className="module-content">{children}</div></details>;
}

function CreateDialog({
  title,
  description,
  nameLabel,
  descriptionEnabled = false,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  nameLabel: string;
  descriptionEnabled?: boolean;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (name: string, description?: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nameEntry = data.get('name');
    const descriptionEntry = data.get('description');
    const name = typeof nameEntry === 'string' ? nameEntry.trim() : '';
    const detail =
      typeof descriptionEntry === 'string' ? descriptionEntry.trim() : '';
    onSubmit(name, detail || undefined);
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onClose();
    }}>
      <section
        className="create-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        onKeyDown={(event) => handleDialogKeyDown(event, pending, onClose)}
      >
        <header>
          <div><p className="section-kicker">CREATE</p><h2 id="create-title">{title}</h2></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose} disabled={pending}><X size={18} /></button>
        </header>
        <p>{description}</p>
        <form onSubmit={submit}>
          {error ? <div className="form-alert" role="alert"><span>!</span><p>{businessErrorMessage(error)}</p></div> : null}
          <div className="field-group">
            <label htmlFor="create-name">{nameLabel}</label>
            <input id="create-name" name="name" minLength={1} maxLength={120} required autoFocus />
          </div>
          {descriptionEnabled ? (
            <div className="field-group">
              <label htmlFor="create-description">描述（可选）</label>
              <input id="create-description" name="description" maxLength={500} />
            </div>
          ) : null}
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={pending}>取消</button>
            <button className="primary-button content-button" type="submit" disabled={pending}>{pending ? '正在创建' : '创建'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function handleDialogKeyDown(
  event: KeyboardEvent<HTMLElement>,
  pending: boolean,
  onClose: () => void,
): void {
  if (event.key === 'Escape' && !pending) {
    event.preventDefault();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ),
  );
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function LoadingPanel({ label, compact = false }: { label: string; compact?: boolean }) {
  return <div className={`content-state${compact ? ' compact' : ''}`} aria-busy="true"><span className="loading-bar" /><strong>{label}</strong></div>;
}

function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="content-error" role="alert">
      <div><strong>无法加载内容</strong><p>{businessErrorMessage(error)}</p></div>
      <button className="secondary-button" type="button" onClick={retry}>重试</button>
    </div>
  );
}

function businessErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '服务暂时不可用，请稍后重试。';
  if (error.status === 429) return error.retryAfterSeconds ? `请求过于频繁，请在 ${error.retryAfterSeconds} 秒后重试。` : '请求过于频繁，请稍后重试。';
  if (error.status === 503 || error.status === 0) return 'Workspace 服务暂时不可用，请稍后重试。';
  if (error.code === 'KNOWLEDGE_BASE_CONFLICT') return '当前 Workspace 已有同名知识库。';
  if (error.code === 'VALIDATION_ERROR') return '请检查名称或描述格式。';
  return '操作未完成，请稍后重试。';
}

function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function workspaceRoleLabel(role: WorkspaceRole): string {
  return role === 'owner' ? 'Owner' : role === 'admin' ? '管理员' : '成员';
}

function workspaceSubtitle(
  query: { isPending: boolean; isError: boolean; data?: WorkspaceSummary[] },
  selected?: WorkspaceSummary,
): string {
  if (query.isPending) return '正在加载你的 Workspace。';
  if (query.isError) return 'Workspace 信息暂时不可用。';
  if (!query.data?.length) return '创建 Workspace，开始组织团队知识。';
  return selected ? `${workspaceRoleLabel(selected.role)} · ${selected.knowledgeBaseCount} 个知识库` : '正在切换 Workspace。';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
}
