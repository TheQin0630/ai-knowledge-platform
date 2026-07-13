import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/app.setup';
import { validateEnvironment } from '../src/config/environment.schema';
import { DatabaseModule } from '../src/database/database.module';
import { createPersistenceDataSource } from '../src/database/typeorm.options';
import { AuthModule } from '../src/modules/auth/auth.module';
import {
  WorkspaceMember,
  WorkspaceRole,
} from '../src/modules/workspaces/entities/workspace-member.entity';
import { WorkspacesModule } from '../src/modules/workspaces/workspaces.module';
import { RedisModule } from '../src/redis/redis.module';

jest.setTimeout(180_000);

describe('workspace and knowledge-base authorization', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      new PostgreSqlContainer('pgvector/pgvector:0.8.5-pg17-bookworm')
        .withDatabase('workspace_test')
        .withUsername('workspace_test')
        .withPassword('integration-test-password')
        .start(),
      new RedisContainer('redis:8.4.4-alpine')
        .withPassword('integration-test-password')
        .start(),
    ]);
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = postgres.getConnectionUri();
    process.env.REDIS_URL = redis.getConnectionUrl();
    process.env.JWT_ACCESS_SECRET = '0123456789abcdef0123456789abcdef';
    process.env.JWT_REFRESH_SECRET = 'fedcba9876543210fedcba9876543210';

    const migrations = createPersistenceDataSource(postgres.getConnectionUri());
    await migrations.initialize();
    await migrations.runMigrations();
    await migrations.destroy();

    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          validate: validateEnvironment,
        }),
        DatabaseModule,
        RedisModule,
        AuthModule,
        WorkspacesModule,
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    currentServer = app.getHttpServer();
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    if (app) await app.close();
    currentServer = undefined;
    if (postgres) await postgres.stop();
    if (redis) await redis.stop();
  });

  it('enforces owner, admin, member, and outsider access without leaking tenants', async () => {
    const owner = await createIdentity('owner@example.com');
    const admin = await createIdentity('admin@example.com');
    const member = await createIdentity('member@example.com');
    const outsider = await createIdentity('outsider@example.com');

    await request(app.getHttpServer()).get('/api/v1/workspaces').expect(401);
    const workspaceResponse = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .auth(owner.token, { type: 'bearer' })
      .send({ name: '  Platform Engineering  ' })
      .expect(201);
    expect(workspaceResponse.body).toMatchObject({
      name: 'Platform Engineering',
      role: WorkspaceRole.OWNER,
      knowledgeBaseCount: 0,
    });
    const workspaceId = readId(workspaceResponse.body);

    const memberships = dataSource.getRepository(WorkspaceMember);
    await memberships.save([
      memberships.create({
        workspaceId,
        userId: admin.userId,
        role: WorkspaceRole.ADMIN,
      }),
      memberships.create({
        workspaceId,
        userId: member.userId,
        role: WorkspaceRole.MEMBER,
      }),
    ]);

    await createKnowledgeBase(workspaceId, owner.token, 'Architecture', 201);
    await createKnowledgeBase(workspaceId, admin.token, 'Runbooks', 201);
    await createKnowledgeBase(workspaceId, member.token, 'Denied', 403).expect({
      error: {
        code: 'WORKSPACE_PERMISSION_DENIED',
        message: 'Workspace role does not allow this action',
      },
    });
    await createKnowledgeBase(
      workspaceId,
      outsider.token,
      'Hidden',
      404,
    ).expect({
      error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/workspaces/${workspaceId}/knowledge-bases`)
      .auth(owner.token, { type: 'bearer' })
      .send({ name: 'architecture' })
      .expect(409)
      .expect({
        error: {
          code: 'KNOWLEDGE_BASE_CONFLICT',
          message: 'A knowledge base with this name already exists',
        },
      });

    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/knowledge-bases`)
      .auth(member.token, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        const items: unknown = response.body;
        expect(items).toHaveLength(2);
        if (!Array.isArray(items)) throw new Error('Expected knowledge bases');
        expect(items.map((item) => readString(item, 'name'))).toEqual([
          'Architecture',
          'Runbooks',
        ]);
      });
    await request(app.getHttpServer())
      .get(`/api/v1/workspaces/${workspaceId}/knowledge-bases`)
      .auth(outsider.token, { type: 'bearer' })
      .expect(404);

    await request(app.getHttpServer())
      .get('/api/v1/workspaces')
      .auth(owner.token, { type: 'bearer' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual([
          expect.objectContaining({
            id: workspaceId,
            role: WorkspaceRole.OWNER,
            knowledgeBaseCount: 2,
          }),
        ]);
      });
    await request(app.getHttpServer())
      .get('/api/v1/workspaces')
      .auth(outsider.token, { type: 'bearer' })
      .expect(200)
      .expect([]);
  });

  async function createIdentity(
    email: string,
  ): Promise<{ userId: string; token: string }> {
    const password = 'correct horse battery staple';
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201);
    const loggedIn = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return {
      userId: readId(registered.body),
      token: readString(loggedIn.body, 'accessToken'),
    };
  }
});

function createKnowledgeBase(
  workspaceId: string,
  token: string,
  name: string,
  status: number,
) {
  return request(appServer())
    .post(`/api/v1/workspaces/${workspaceId}/knowledge-bases`)
    .auth(token, { type: 'bearer' })
    .send({ name })
    .expect(status);
}

let currentServer: App | undefined;
function appServer(): App {
  if (!currentServer) throw new Error('Test server is not initialized');
  return currentServer;
}

function readId(value: unknown): string {
  return readString(value, 'id');
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'object' || value === null)
    throw new Error('Expected object');
  const fieldValue = (value as Record<string, unknown>)[field];
  if (typeof fieldValue !== 'string') throw new Error(`Expected ${field}`);
  return fieldValue;
}
