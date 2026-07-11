import {
  INestApplication,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { LoginAttemptLimiter } from '../src/modules/auth/abuse/login-attempt-limiter';
import type {
  LoginAttempt,
  LoginLimitDecision,
} from '../src/modules/auth/abuse/login-attempt-limiter';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AccessTokenGuard } from '../src/modules/auth/guard/access-token.guard';
import { AuthSecurityEventLogger } from '../src/modules/auth/security/auth-security-event.logger';
import { RedisSessionStore } from '../src/modules/auth/session/redis-session.store';
import { AuthTokenService } from '../src/modules/auth/token/auth-token.service';
import { UserRole } from '../src/modules/identity/entities/user.entity';

describe('Registration contract (e2e)', () => {
  const register = jest.fn();
  const login = jest.fn();
  const refresh = jest.fn();
  const logout = jest.fn();
  const getCurrentUser = jest.fn();
  const verifyAccess = jest.fn();
  const getSession = jest.fn();
  const consumeLoginAttempt = jest.fn<
    Promise<LoginLimitDecision>,
    [LoginAttempt]
  >();
  const logLoginSucceeded = jest.fn();
  const logLoginRejected = jest.fn();
  const logDependencyUnavailable = jest.fn();
  let app: INestApplication<App>;

  beforeEach(async () => {
    register.mockReset().mockResolvedValue({
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      email: 'owner@example.com',
      role: UserRole.USER,
      createdAt: '2026-07-10T00:00:00.000Z',
    });
    login.mockReset().mockResolvedValue({
      body: {
        accessToken: 'access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
          email: 'owner@example.com',
          role: UserRole.USER,
        },
      },
      refreshToken: 'refresh-token',
      refreshExpiresIn: 604_800,
    });
    refresh.mockReset().mockResolvedValue({
      body: {
        accessToken: 'next-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      },
      refreshToken: 'next-refresh-token',
      refreshExpiresIn: 604_800,
    });
    logout.mockReset().mockResolvedValue(undefined);
    getCurrentUser.mockReset().mockResolvedValue({
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      email: 'owner@example.com',
      role: UserRole.USER,
      createdAt: '2026-07-10T00:00:00.000Z',
    });
    verifyAccess.mockReset().mockImplementation((token: string) => {
      if (token !== 'access-token') {
        return Promise.reject(new Error('invalid token'));
      }
      return Promise.resolve({
        sub: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
        sid: '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
        role: UserRole.USER,
      });
    });
    getSession.mockReset().mockResolvedValue({
      sessionId: '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
      userId: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      refreshTokenDigest: 'digest',
    });
    consumeLoginAttempt.mockReset().mockResolvedValue({ allowed: true });
    logLoginSucceeded.mockReset();
    logLoginRejected.mockReset();
    logDependencyUnavailable.mockReset();

    const moduleFixture = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register,
            login,
            refresh,
            logout,
            getCurrentUser,
          },
        },
        AccessTokenGuard,
        {
          provide: LoginAttemptLimiter,
          useValue: { consume: consumeLoginAttempt },
        },
        {
          provide: AuthSecurityEventLogger,
          useValue: {
            loginSucceeded: logLoginSucceeded,
            loginRejected: logLoginRejected,
            dependencyUnavailable: logDependencyUnavailable,
          },
        },
        { provide: AuthTokenService, useValue: { verifyAccess } },
        { provide: RedisSessionStore, useValue: { get: getSession } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('returns access state and keeps the refresh token in a strict cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: '  Owner@Example.COM ',
        password: 'correct horse battery staple',
      })
      .expect(200)
      .expect({
        accessToken: 'access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
          email: 'owner@example.com',
          role: UserRole.USER,
        },
      });

    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(
        /^refresh_token=refresh-token; Max-Age=604800; Path=\/api\/v1\/auth; Expires=.*; HttpOnly; SameSite=Strict$/,
      ),
    ]);
    expect(login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    });
    expect(consumeLoginAttempt).toHaveBeenCalledTimes(1);
    expect(consumeLoginAttempt.mock.calls[0][0].email).toBe(
      'owner@example.com',
    );
    expect(typeof consumeLoginAttempt.mock.calls[0][0].sourceAddress).toBe(
      'string',
    );
    expect(logLoginSucceeded).toHaveBeenCalledWith(
      response.headers['x-request-id'],
    );
    expect(JSON.stringify(response.body)).not.toContain('refresh-token');
  });

  it('records invalid credentials without logging submitted identity or password', async () => {
    login.mockRejectedValueOnce(
      new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
      })
      .expect(401);

    expect(logLoginRejected).toHaveBeenCalledWith(
      response.headers['x-request-id'],
      'invalid_credentials',
    );
    expect(JSON.stringify(logLoginRejected.mock.calls)).not.toMatch(
      /owner@example\.com|correct horse battery staple/,
    );
  });

  it('returns 429 with Retry-After before credential verification when limited', async () => {
    consumeLoginAttempt.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 317,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
      })
      .expect(429)
      .expect({
        error: {
          code: 'AUTH_RATE_LIMITED',
          message: 'Too many authentication attempts',
        },
      });

    expect(response.headers['retry-after']).toBe('317');
    expect(login).not.toHaveBeenCalled();
    expect(logLoginRejected).toHaveBeenCalledWith(
      response.headers['x-request-id'],
      'rate_limited',
    );
  });

  it('ignores untrusted X-Forwarded-For values by default', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
      })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '198.51.100.20')
      .send({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
      })
      .expect(200);

    const firstAddress = consumeLoginAttempt.mock.calls[0][0].sourceAddress;
    const secondAddress = consumeLoginAttempt.mock.calls[1][0].sourceAddress;
    expect(firstAddress).toBe(secondAddress);
    expect(firstAddress).not.toBe('203.0.113.10');
    expect(secondAddress).not.toBe('198.51.100.20');
  });

  it('fails closed with a sanitized 503 when login limiting is unavailable', async () => {
    consumeLoginAttempt.mockRejectedValueOnce(
      new ServiceUnavailableException({
        error: {
          code: 'AUTH_RATE_LIMIT_UNAVAILABLE',
          message: 'Authentication rate limit service is unavailable',
        },
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
      })
      .expect(503)
      .expect({
        error: {
          code: 'AUTH_RATE_LIMIT_UNAVAILABLE',
          message: 'Authentication rate limit service is unavailable',
        },
      });

    expect(login).not.toHaveBeenCalled();
    expect(logDependencyUnavailable).toHaveBeenCalledWith(
      response.headers['x-request-id'],
      'login',
    );
  });

  it('refreshes only from the strict cookie and replaces it', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=current-refresh-token')
      .send({ refreshToken: 'body-token-must-be-ignored' })
      .expect(200)
      .expect({
        accessToken: 'next-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });

    expect(refresh).toHaveBeenCalledWith(
      'current-refresh-token',
      response.headers['x-request-id'],
    );
    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(
        /^refresh_token=next-refresh-token; Max-Age=604800; Path=\/api\/v1\/auth; Expires=.*; HttpOnly; SameSite=Strict$/,
      ),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('next-refresh-token');
  });

  it('marks issued and cleared refresh cookies Secure in production', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'owner@example.com',
          password: 'correct horse battery staple',
        })
        .expect(200);
      const logoutResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', 'refresh_token=current-refresh-token')
        .expect(204);

      expect(loginResponse.headers['set-cookie']).toEqual([
        expect.stringMatching(
          /^refresh_token=refresh-token; Max-Age=604800; Path=\/api\/v1\/auth; Expires=.*; HttpOnly; Secure; SameSite=Strict$/,
        ),
      ]);
      expect(logoutResponse.headers['set-cookie']).toEqual([
        expect.stringMatching(
          /^refresh_token=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict$/,
        ),
      ]);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it('logs out idempotently and expires the scoped refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refresh_token=current-refresh-token')
      .expect(204);

    expect(logout).toHaveBeenCalledWith(
      'current-refresh-token',
      response.headers['x-request-id'],
    );
    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(
        /^refresh_token=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict$/,
      ),
    ]);
  });

  it('expires the refresh cookie even when server-side revocation fails', async () => {
    logout.mockRejectedValueOnce(sessionUnavailable());

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refresh_token=current-refresh-token')
      .expect(503);

    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(
        /^refresh_token=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict$/,
      ),
    ]);
    expect(response.body).toEqual({
      error: {
        code: 'AUTH_SESSION_UNAVAILABLE',
        message: 'Authentication session service is unavailable',
      },
    });
  });

  it('returns a sanitized 503 when Redis session lookup fails', async () => {
    getSession.mockRejectedValueOnce(sessionUnavailable());

    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer access-token')
      .expect(503)
      .expect({
        error: {
          code: 'AUTH_SESSION_UNAVAILABLE',
          message: 'Authentication session service is unavailable',
        },
      });

    expect(JSON.stringify(response.body)).not.toContain('Redis');
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('returns the current identity for an access token with an active session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect({
        id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
        email: 'owner@example.com',
        role: UserRole.USER,
        createdAt: '2026-07-10T00:00:00.000Z',
      });

    expect(getCurrentUser).toHaveBeenCalledWith(
      '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
    );
  });

  it.each([undefined, 'Bearer refresh-token'])(
    'rejects /me without a valid access Bearer token',
    async (authorization) => {
      const call = request(app.getHttpServer()).get('/api/v1/auth/me');
      if (authorization) {
        call.set('Authorization', authorization);
      }

      await call.expect(401).expect({
        error: {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Access token is invalid or expired',
        },
      });
      expect(getCurrentUser).not.toHaveBeenCalled();
    },
  );

  afterEach(async () => {
    await app.close();
  });

  it('registers a normalized least-privileged identity', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: '  Owner@Example.COM ',
        password: 'correct horse battery staple',
      })
      .expect(201)
      .expect({
        id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
        email: 'owner@example.com',
        role: 'user',
        createdAt: '2026-07-10T00:00:00.000Z',
      });

    expect(register).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    });
  });

  it.each([
    {
      body: {
        email: 'owner@example.com',
        password: 'correct horse battery staple',
        role: 'admin',
      },
      field: 'role',
    },
    {
      body: { email: 'owner@example.com', password: 'too-short' },
      field: 'password',
    },
  ])('rejects invalid public field $field', async ({ body, field }) => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(body)
      .expect(422)
      .expect({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: { fields: [field] },
        },
      });

    expect(register).not.toHaveBeenCalled();
  });
});

function sessionUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: {
      code: 'AUTH_SESSION_UNAVAILABLE',
      message: 'Authentication session service is unavailable',
    },
  });
}
