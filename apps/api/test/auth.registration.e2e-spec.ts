import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AccessTokenGuard } from '../src/modules/auth/guard/access-token.guard';
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
    expect(JSON.stringify(response.body)).not.toContain('refresh-token');
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

    expect(refresh).toHaveBeenCalledWith('current-refresh-token');
    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(
        /^refresh_token=next-refresh-token; Max-Age=604800; Path=\/api\/v1\/auth; Expires=.*; HttpOnly; SameSite=Strict$/,
      ),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('next-refresh-token');
  });

  it('logs out idempotently and expires the scoped refresh cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refresh_token=current-refresh-token')
      .expect(204);

    expect(logout).toHaveBeenCalledWith('current-refresh-token');
    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(
        /^refresh_token=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict$/,
      ),
    ]);
  });

  it('expires the refresh cookie even when server-side revocation fails', async () => {
    logout.mockRejectedValueOnce(new Error('Redis unavailable'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', 'refresh_token=current-refresh-token')
      .expect(500);

    expect(response.headers['set-cookie']).toEqual([
      expect.stringMatching(
        /^refresh_token=; Path=\/api\/v1\/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict$/,
      ),
    ]);
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
