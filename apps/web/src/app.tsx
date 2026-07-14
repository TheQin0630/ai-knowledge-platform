import {
  ArrowUpRight,
  Eye,
  EyeOff,
  Library,
  ShieldCheck,
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ApiError,
  authClient,
  CurrentUser,
  LoginSession,
} from './api/auth-client';
import { WorkspaceWorkbench } from './workbench';

type AuthState =
  | { status: 'restoring' }
  | { status: 'anonymous'; message?: string }
  | { status: 'authenticated'; accessToken: string; user: CurrentUser };

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 30_000 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthenticationApp queryClient={queryClient} />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AuthenticationApp({ queryClient }: { queryClient: QueryClient }) {
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
    <Routes>
      <Route
        path="/"
        element={
          <WorkspaceWorkbench
            accessToken={auth.accessToken}
            user={auth.user}
            onSessionExpired={() => {
              queryClient.clear();
              setAuth({ status: 'anonymous', message: '会话已过期，请重新登录。' });
            }}
            onLogout={async () => {
              try {
                await authClient.logout();
              } finally {
                queryClient.clear();
                setAuth({ status: 'anonymous' });
              }
            }}
          />
        }
      />
      <Route
        path="/workspaces/:workspaceId"
        element={
          <WorkspaceWorkbench
            accessToken={auth.accessToken}
            user={auth.user}
            onSessionExpired={() => {
              queryClient.clear();
              setAuth({ status: 'anonymous', message: '会话已过期，请重新登录。' });
            }}
            onLogout={async () => {
              try {
                await authClient.logout();
              } finally {
                queryClient.clear();
                setAuth({ status: 'anonymous' });
              }
            }}
          />
        }
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
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
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(initialMessage);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const emailEntry = data.get('email');
    const passwordEntry = data.get('password');
    const passwordConfirmationEntry = data.get('passwordConfirmation');
    const email = typeof emailEntry === 'string' ? emailEntry : '';
    const password = typeof passwordEntry === 'string' ? passwordEntry : '';
    const passwordConfirmation =
      typeof passwordConfirmationEntry === 'string'
        ? passwordConfirmationEntry
        : '';

    if (mode === 'register' && password !== passwordConfirmation) {
      setMessage('两次输入的密码不一致。');
      return;
    }

    setSubmitting(true);
    setMessage(undefined);
    try {
      if (mode === 'register') {
        await authClient.register(email, password);
      }
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
            <p className="eyebrow">
              {mode === 'login' ? '欢迎回来' : '开始使用'}
            </p>
            <h2 id="login-title">
              {mode === 'login' ? '登录工作区' : '创建账户'}
            </h2>
            <p>
              {mode === 'login'
                ? '使用你的组织账号继续。'
                : '注册后即可创建你的第一个 Workspace。'}
            </p>
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
                autoComplete={mode === 'login' ? 'username' : 'email'}
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
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
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

            {mode === 'register' ? (
              <div className="field-group">
                <label htmlFor="passwordConfirmation">确认密码</label>
                <div className="password-field">
                  <input
                    id="passwordConfirmation"
                    name="passwordConfirmation"
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    placeholder="再次输入账户密码"
                    required
                  />
                </div>
              </div>
            ) : null}

            <button className="primary-button" type="submit" disabled={submitting}>
              <span>
                {submitting
                  ? mode === 'login'
                    ? '正在验证'
                    : '正在创建'
                  : mode === 'login'
                    ? '登录'
                    : '注册并进入'}
              </span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </form>

          <div className="auth-switch">
            <span>{mode === 'login' ? '还没有账户？' : '已有账户？'}</span>
            <button
              type="button"
              onClick={() => {
                setMode((current) =>
                  current === 'login' ? 'register' : 'login',
                );
                setMessage(undefined);
                setPasswordVisible(false);
              }}
            >
              {mode === 'login' ? '创建账户' : '返回登录'}
            </button>
          </div>
          <p className="login-support">账户访问问题请联系组织管理员</p>
        </div>
      </section>
    </main>
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
    case 'IDENTITY_CONFLICT':
      return '该邮箱已注册，请直接登录。';
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
