import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/app.setup';
import { validateEnvironment } from '../src/config/environment.schema';
import { DatabaseModule } from '../src/database/database.module';
import { createPersistenceDataSource } from '../src/database/typeorm.options';
import { AuthModule } from '../src/modules/auth/auth.module';
import { RedisSessionStore } from '../src/modules/auth/session/redis-session.store';
import { AuthTokenService } from '../src/modules/auth/token/auth-token.service';
import { HealthModule } from '../src/modules/health/health.module';
import { UserRole } from '../src/modules/identity/entities/user.entity';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { RedisModule } from '../src/redis/redis.module';

const accessSecret = '0123456789abcdef0123456789abcdef';
const refreshSecret = 'fedcba9876543210fedcba9876543210';
const email = 'owner@example.com';
const password = 'correct horse battery staple';

jest.setTimeout(180_000);

describe('authentication attack chain', () => {
  let postgresContainer: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let redis: Redis;
  let sessions: RedisSessionStore;
  let tokens: AuthTokenService;

  beforeAll(async () => {
    [postgresContainer, redisContainer] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:0.8.5-pg17-bookworm')
        .withDatabase('ai_knowledge_auth_test')
        .withUsername('ai_knowledge_auth_test')
        .withPassword('integration-test-password')
        .start(),
      new RedisContainer('redis:8.4.4-alpine')
        .withPassword('integration-test-password')
        .start(),
    ]);

    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.DATABASE_URL = postgresContainer.getConnectionUri();
    process.env.REDIS_URL = redisContainer.getConnectionUrl();
    process.env.JWT_ACCESS_SECRET = accessSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;

    const migrationDataSource = createPersistenceDataSource(
      postgresContainer.getConnectionUri(),
    );
    await migrationDataSource.initialize();
    await migrationDataSource.runMigrations();
    await migrationDataSource.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          validate: validateEnvironment,
        }),
        DatabaseModule,
        RedisModule,
        AuthModule,
        HealthModule,
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    redis = moduleFixture.get<Redis>(REDIS_CLIENT);
    sessions = moduleFixture.get(RedisSessionStore);
    tokens = moduleFixture.get(AuthTokenService);
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await redis.flushdb();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (postgresContainer) {
      await postgresContainer.stop();
    }
    if (redisContainer) {
      await redisContainer.stop();
    }
  });

  it('rotates once, revokes replayed sessions, and invalidates access on logout', async () => {
    await register(app);
    const firstLogin = await login(app);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${firstLogin.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ email, role: UserRole.USER });
        expect(response.body).not.toHaveProperty('passwordHash');
      });

    const refreshedResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstLogin.cookie)
      .expect(200);
    const refreshedAccessToken = readStringBodyField(
      refreshedResponse.body,
      'accessToken',
    );
    const refreshedCookie = readRefreshCookie(refreshedResponse);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstLogin.cookie)
      .expect(401)
      .expect(invalidRefreshResponse);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshedAccessToken}`)
      .expect(401)
      .expect(invalidAccessResponse);

    const secondLogin = await login(app);
    const logoutResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', secondLogin.cookie)
      .expect(204);
    expect(readSetCookies(logoutResponse)).toEqual([
      expect.stringContaining('refresh_token=;'),
    ]);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${secondLogin.accessToken}`)
      .expect(401)
      .expect(invalidAccessResponse);
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', refreshedCookie)
      .expect(204);
  });

  it('rejects forged, expired, and wrong-purpose tokens without revoking a valid session', async () => {
    await register(app);
    const authenticated = await login(app);
    const refreshToken = readRefreshToken(authenticated.cookie);
    const accessClaims = await tokens.verifyAccess(authenticated.accessToken);
    const refreshClaims = await tokens.verifyRefresh(refreshToken);
    const jwt = new JwtService();

    const forgedAccess = await signAttackToken(
      jwt,
      accessClaims,
      'access',
      'wrong-secret-wrong-secret-wrong-secret',
      900,
    );
    const expiredAccess = await signAttackToken(
      jwt,
      accessClaims,
      'access',
      accessSecret,
      -1,
    );
    const forgedRefresh = await signAttackToken(
      jwt,
      refreshClaims,
      'refresh',
      'wrong-secret-wrong-secret-wrong-secret',
      900,
    );
    const expiredRefresh = await signAttackToken(
      jwt,
      refreshClaims,
      'refresh',
      refreshSecret,
      -1,
    );

    for (const invalidAccess of [forgedAccess, expiredAccess, refreshToken]) {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${invalidAccess}`)
        .expect(401)
        .expect(invalidAccessResponse);
    }
    for (const invalidRefresh of [
      forgedRefresh,
      expiredRefresh,
      authenticated.accessToken,
    ]) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', `refresh_token=${invalidRefresh}`)
        .expect(401)
        .expect(invalidRefreshResponse);
    }

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${authenticated.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', authenticated.cookie)
      .expect(200);
  });

  it('revokes a refresh token whose Redis user binding was tampered with', async () => {
    await register(app);
    const authenticated = await login(app);
    const refreshToken = readRefreshToken(authenticated.cookie);
    const claims = await tokens.verifyRefresh(refreshToken);
    const session = await sessions.get(claims.sid);
    if (!session) {
      throw new Error('Expected login to create a session');
    }
    await redis.set(
      `auth:session:${claims.sid}`,
      JSON.stringify({ ...session, userId: randomUUID() }),
      'EX',
      3_600,
    );

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', authenticated.cookie)
      .expect(401)
      .expect(invalidRefreshResponse);
    await expect(sessions.get(claims.sid)).resolves.toBeNull();
  });
});

const invalidAccessResponse = {
  error: {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Access token is invalid or expired',
  },
};

const invalidRefreshResponse = {
  error: {
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token is invalid or expired',
  },
};

async function register(app: INestApplication<App>): Promise<void> {
  await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect(201)
    .expect((response) => {
      expect(response.body).toMatchObject({ email, role: UserRole.USER });
      expect(response.body).not.toHaveProperty('passwordHash');
    });
}

async function login(app: INestApplication<App>): Promise<{
  accessToken: string;
  cookie: string;
}> {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return {
    accessToken: readStringBodyField(response.body, 'accessToken'),
    cookie: readRefreshCookie(response),
  };
}

function readStringBodyField(body: unknown, field: string): string {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Expected a JSON object response');
  }
  const value = (body as Record<string, unknown>)[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected response field ${field} to be a string`);
  }
  return value;
}

function readRefreshCookie(response: unknown): string {
  const cookies = readSetCookies(response);
  const cookie = cookies.find((value) => value.startsWith('refresh_token='));
  if (!cookie) {
    throw new Error('Expected a refresh_token Set-Cookie header');
  }
  return cookie.split(';', 1)[0];
}

function readSetCookies(response: unknown): string[] {
  if (typeof response !== 'object' || response === null) {
    throw new Error('Expected an HTTP response');
  }
  const headers = (response as { headers?: unknown }).headers;
  if (typeof headers !== 'object' || headers === null) {
    throw new Error('Expected HTTP response headers');
  }
  const setCookie = (headers as Record<string, unknown>)['set-cookie'];
  if (!Array.isArray(setCookie) || !setCookie.every(isString)) {
    throw new Error('Expected Set-Cookie response headers');
  }
  return setCookie;
}

function readRefreshToken(cookie: string): string {
  const prefix = 'refresh_token=';
  if (!cookie.startsWith(prefix)) {
    throw new Error('Expected refresh_token cookie');
  }
  return cookie.slice(prefix.length);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

async function signAttackToken(
  jwt: JwtService,
  identity: { sub: string; sid: string; role: UserRole },
  purpose: 'access' | 'refresh',
  secret: string,
  expiresIn: number,
): Promise<string> {
  return jwt.signAsync(
    {
      sub: identity.sub,
      sid: identity.sid,
      jti: randomUUID(),
      purpose,
      role: identity.role,
    },
    {
      secret: Buffer.from(secret),
      algorithm: 'HS256',
      issuer: 'ai-knowledge-platform',
      audience: 'ai-knowledge-api',
      expiresIn,
    },
  );
}
