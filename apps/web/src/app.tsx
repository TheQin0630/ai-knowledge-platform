import {
  ArrowUpRight,
  BookOpenText,
  CheckCircle2,
  CircleUserRound,
  Database,
  Eye,
  EyeOff,
  FileText,
  Gauge,
  Library,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ApiError,
  authClient,
  CurrentUser,
  LoginSession,
} from './api/auth-client';

type AuthState =
  | { status: 'restoring' }
  | { status: 'anonymous'; message?: string }
  | { status: 'authenticated'; accessToken: string; user: CurrentUser };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'restoring' });
  const restorationStarted = useRef(false);

  useEffect(() => {
    if (restorationStarted.current) return;
    restorationStarted.current = true;

    void restoreSession().then(setAuth);
  }, []);

  if (auth.status === 'restoring') {
    return <SessionSkeleton />;
  }

  if (auth.status === 'anonymous') {
    return (
      <LoginScreen
        initialMessage={auth.message}
        onAuthenticated={(session) => {
          setAuth({
            status: 'authenticated',
            accessToken: session.accessToken,
            user: session.user,
          });
        }}
      />
    );
  }

  return (
    <Workbench
      user={auth.user}
      onLogout={async () => {
        try {
          await authClient.logout();
        } finally {
          setAuth({ status: 'anonymous' });
        }
      }}
    />
  );
}

async function restoreSession(): Promise<AuthState> {
  try {
    const session = await authClient.refresh();
    const user = await authClient.me(session.accessToken);
    return {
      status: 'authenticated',
      accessToken: session.accessToken,
      user,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'anonymous' };
    }
    return { status: 'anonymous', message: errorMessage(error) };
  }
}

function LoginScreen({
  initialMessage,
  onAuthenticated,
}: {
  initialMessage?: string;
  onAuthenticated: (session: LoginSession) => void;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(initialMessage);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const emailEntry = data.get('email');
    const passwordEntry = data.get('password');
    const email = typeof emailEntry === 'string' ? emailEntry : '';
    const password = typeof passwordEntry === 'string' ? passwordEntry : '';

    setSubmitting(true);
    setMessage(undefined);
    try {
      onAuthenticated(await authClient.login(email, password));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="brand-panel" aria-labelledby="brand-title">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Library size={22} strokeWidth={2.2} />
          </span>
          <span>KNOWLEDGE OS</span>
        </div>

        <div className="brand-statement">
          <p className="eyebrow">企业知识智能中枢</p>
          <h1 id="brand-title">让组织知识持续可用</h1>
          <div className="brand-rule" />
          <p className="brand-meta">
            <ShieldCheck size={17} aria-hidden="true" />
            受保护的组织工作区
          </p>
        </div>

        <p className="brand-footnote">PRIVATE WORKSPACE / 2026</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="mobile-brand">
          <span className="brand-mark" aria-hidden="true">
            <Library size={19} />
          </span>
          <span>KNOWLEDGE OS</span>
        </div>

        <div className="login-form-wrap">
          <header className="login-header">
            <p className="eyebrow">欢迎回来</p>
            <h2 id="login-title">登录工作区</h2>
            <p>使用你的组织账号继续。</p>
          </header>

          <form
            className="login-form"
            onSubmit={(event) => {
              void handleSubmit(event);
            }}
          >
            {message ? (
              <div className="form-alert" role="alert">
                <span aria-hidden="true">!</span>
                <p>{message}</p>
              </div>
            ) : null}

            <div className="field-group">
              <label htmlFor="email">工作邮箱</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                maxLength={320}
                placeholder="name@company.com"
                required
                autoFocus
              />
            </div>

            <div className="field-group">
              <label htmlFor="password">密码</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  minLength={12}
                  maxLength={128}
                  placeholder="输入账户密码"
                  required
                />
                <button
                  className="icon-button password-toggle"
                  type="button"
                  aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                  title={passwordVisible ? '隐藏密码' : '显示密码'}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button className="primary-button" type="submit" disabled={submitting}>
              <span>{submitting ? '正在验证' : '登录'}</span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </form>

          <p className="login-support">账户访问问题请联系组织管理员</p>
        </div>
      </section>
    </main>
  );
}

function Workbench({
  user,
  onLogout,
}: {
  user: CurrentUser;
  onLogout: () => Promise<void>;
}) {
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <Library size={20} />
          </span>
          <span>KNOWLEDGE OS</span>
        </div>

        <nav className="primary-nav" aria-label="主导航">
          <a className="nav-item active" href="#overview" aria-current="page">
            <Gauge size={18} aria-hidden="true" />
            工作台
          </a>
          <a className="nav-item" href="#knowledge-bases">
            <BookOpenText size={18} aria-hidden="true" />
            知识库
          </a>
        </nav>

        <div className="sidebar-account">
          <span className="avatar" aria-hidden="true">
            {user.email.charAt(0).toUpperCase()}
          </span>
          <span className="account-copy">
            <strong>{user.email}</strong>
            <small>{roleLabel(user.role)}</small>
          </span>
        </div>
      </aside>

      <div className="workspace-shell">
        <header className="topbar">
          <span className="mobile-top-brand" aria-label="Knowledge OS">
            <Library size={18} aria-hidden="true" />
          </span>
          <div className="breadcrumb">
            <span>组织空间</span>
            <span>/</span>
            <strong>工作台</strong>
          </div>
          <div className="topbar-actions">
            <span className="system-badge">
              <span className="status-dot" />
              会话已保护
            </span>
            <button
              className="icon-button"
              aria-label="退出登录"
              title="退出登录"
              disabled={loggingOut}
              onClick={() => {
                setLoggingOut(true);
                void onLogout();
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="workspace" id="overview">
          <header className="page-header">
            <div>
              <p className="eyebrow">OVERVIEW</p>
              <h1>知识工作台</h1>
              <p>早上好，{emailName(user.email)}。</p>
            </div>
            <div className="identity-chip">
              <CircleUserRound size={18} aria-hidden="true" />
              <span>{roleLabel(user.role)}</span>
            </div>
          </header>

          <section className="workspace-grid" aria-label="工作区概览">
            <article className="focus-panel" id="knowledge-bases">
              <div className="panel-heading">
                <div>
                  <p className="section-kicker">START HERE</p>
                  <h2>建立你的知识空间</h2>
                </div>
                <Database size={22} aria-hidden="true" />
              </div>
              <div className="empty-visual" aria-hidden="true">
                <span className="document-sheet sheet-back" />
                <span className="document-sheet sheet-front">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              <div className="empty-copy">
                <strong>暂无知识库</strong>
                <p>当前组织空间尚无知识库。</p>
              </div>
            </article>

            <aside className="status-panel" aria-label="账户状态">
              <div className="panel-heading compact">
                <div>
                  <p className="section-kicker">ACCOUNT</p>
                  <h2>账户状态</h2>
                </div>
                <CheckCircle2 size={20} aria-hidden="true" />
              </div>
              <dl className="status-list">
                <div>
                  <dt>身份</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>角色</dt>
                  <dd>{roleLabel(user.role)}</dd>
                </div>
                <div>
                  <dt>会话</dt>
                  <dd className="positive">有效</dd>
                </div>
              </dl>
            </aside>

            <section className="recent-panel" aria-labelledby="recent-title">
              <div className="panel-heading compact">
                <div>
                  <p className="section-kicker">RECENT</p>
                  <h2 id="recent-title">最近访问</h2>
                </div>
              </div>
              <div className="recent-empty">
                <span className="recent-icon" aria-hidden="true">
                  <FileText size={20} />
                </span>
                <div>
                  <strong>暂无访问记录</strong>
                  <p>当前没有可显示的历史记录。</p>
                </div>
              </div>
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}

function SessionSkeleton() {
  return (
    <main className="session-skeleton" aria-busy="true" aria-label="正在恢复会话">
      <span className="brand-mark pulse" aria-hidden="true">
        <Library size={22} />
      </span>
      <strong>KNOWLEDGE OS</strong>
      <span>正在恢复安全会话</span>
    </main>
  );
}

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '认证服务暂时不可用，请稍后重试。';
  }

  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return '邮箱或密码不正确。';
    case 'AUTH_RATE_LIMITED':
      return error.retryAfterSeconds
        ? `尝试次数过多，请在 ${error.retryAfterSeconds} 秒后重试。`
        : '尝试次数过多，请稍后重试。';
    case 'VALIDATION_ERROR':
      return '请检查邮箱和密码格式。';
    case 'AUTH_RATE_LIMIT_UNAVAILABLE':
    case 'AUTH_SESSION_UNAVAILABLE':
    case 'NETWORK_UNAVAILABLE':
      return '认证服务暂时不可用，请稍后重试。';
    default:
      return '登录失败，请稍后重试。';
  }
}

function roleLabel(role: CurrentUser['role']): string {
  return role === 'admin' ? '管理员' : '成员';
}

function emailName(email: string): string {
  return email.split('@')[0] || '成员';
}
