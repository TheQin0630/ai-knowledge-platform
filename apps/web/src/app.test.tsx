import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';

const user = {
  id: 'a0d41b34-c429-49b0-b27a-f6c754ce6ac9',
  email: 'analyst@example.com',
  role: 'user' as const,
};

describe('authentication workspace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('logs in without persisting the access token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(401, invalidRefreshError))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: 'access-token',
          tokenType: 'Bearer',
          expiresIn: 900,
          user,
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await userEvent.type(await screen.findByLabelText('工作邮箱'), user.email);
    await userEvent.type(screen.getByLabelText('密码'), 'correct-password');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(
      await screen.findByRole('heading', { name: '知识工作台' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(user.email)).not.toHaveLength(0);
    expect(localStorage).toHaveLength(0);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          email: user.email,
          password: 'correct-password',
        }),
      }),
    );
  });

  it('restores a cookie-backed session and logs out', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          accessToken: 'restored-access-token',
          tokenType: 'Bearer',
          expiresIn: 900,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, user))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: '知识工作台' }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/me');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      Authorization: 'Bearer restored-access-token',
    });

    await userEvent.click(screen.getByRole('button', { name: '退出登录' }));

    expect(await screen.findByLabelText('工作邮箱')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('shows the server retry window when login is rate limited', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(401, invalidRefreshError))
      .mockResolvedValueOnce(
        jsonResponse(
          429,
          {
            error: {
              code: 'AUTH_RATE_LIMITED',
              message: 'Too many authentication attempts',
            },
          },
          { 'Retry-After': '60' },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    await userEvent.type(await screen.findByLabelText('工作邮箱'), user.email);
    await userEvent.type(screen.getByLabelText('密码'), 'incorrect-password');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '尝试次数过多，请在 60 秒后重试。',
    );
  });
});

const invalidRefreshError = {
  error: {
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid or expired',
  },
};

function jsonResponse(
  status: number,
  body: unknown,
  headers?: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
