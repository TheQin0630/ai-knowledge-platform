import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/app.setup';
import { DatabaseModule } from '../src/database/database.module';
import { createPersistenceDataSource } from '../src/database/typeorm.options';
import { AuthModule } from '../src/modules/auth/auth.module';
import { User, UserRole } from '../src/modules/identity/entities/user.entity';
import { KnowledgeBase } from '../src/modules/knowledge-bases/entities/knowledge-base.entity';
import { Workspace } from '../src/modules/workspaces/entities/workspace.entity';
import {
  WorkspaceMember,
  WorkspaceRole,
} from '../src/modules/workspaces/entities/workspace-member.entity';
import { REDIS_CLIENT } from '../src/redis/redis.constants';

jest.setTimeout(120_000);

describe('initial persistence migration', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(
      'pgvector/pgvector:0.8.5-pg17-bookworm',
    )
      .withDatabase('ai_knowledge_test')
      .withUsername('ai_knowledge_test')
      .withPassword('integration-test-password')
      .start();

    dataSource = createPersistenceDataSource(container.getConnectionUri());
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }

    if (container) {
      await container.stop();
    }
  });

  it('upgrades, enforces identity invariants, reverts, and upgrades again', async () => {
    const appliedMigrations = await dataSource.runMigrations();
    expect(appliedMigrations).toHaveLength(4);

    const extension = await dataSource.query<Array<{ extversion: string }>>(
      `SELECT extversion FROM pg_extension WHERE extname = 'vector'`,
    );
    expect(extension).toEqual([{ extversion: '0.8.5' }]);

    const retrievalSchema = await dataSource.query<
      Array<{ chunks_table: string | null; embedding_type: string | null }>
    >(
      `SELECT
         to_regclass('public.document_chunks')::text AS chunks_table,
         (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding') AS embedding_type`,
    );
    expect(retrievalSchema).toEqual([
      { chunks_table: 'document_chunks', embedding_type: 'vector' },
    ]);

    const implicitUuidExtensions = await dataSource.query<
      Array<{ extname: string }>
    >(
      `SELECT extname
       FROM pg_extension
       WHERE extname IN ('uuid-ossp', 'pgcrypto')`,
    );
    expect(implicitUuidExtensions).toEqual([]);

    const enumLabels = await dataSource.query<Array<{ enumlabel: string }>>(
      `SELECT enumlabel
       FROM pg_enum
       JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
       WHERE pg_type.typname = 'user_role'
       ORDER BY pg_enum.enumsortorder`,
    );
    expect(enumLabels.map(({ enumlabel }) => enumlabel)).toEqual([
      UserRole.USER,
      UserRole.ADMIN,
    ]);

    const users = dataSource.getRepository(User);
    const createdUser = await users.save(
      users.create({
        email: '  Owner@Example.COM ',
        passwordHash: 'argon2id-test-hash',
      }),
    );

    expect(createdUser.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(createdUser.email).toBe('owner@example.com');
    expect(createdUser.role).toBe(UserRole.USER);
    expect(createdUser.createdAt).toBeInstanceOf(Date);
    expect(createdUser.updatedAt).toBeInstanceOf(Date);

    const reloadedUser = await users.findOneByOrFail({ id: createdUser.id });
    expect(reloadedUser.passwordHash).toBeUndefined();

    const workspaces = dataSource.getRepository(Workspace);
    const members = dataSource.getRepository(WorkspaceMember);
    const knowledgeBases = dataSource.getRepository(KnowledgeBase);
    const workspace = await workspaces.save(
      workspaces.create({
        name: 'Platform Engineering',
        createdBy: createdUser.id,
      }),
    );
    await members.save(
      members.create({
        workspaceId: workspace.id,
        userId: createdUser.id,
        role: WorkspaceRole.OWNER,
      }),
    );
    const knowledgeBase = await knowledgeBases.save(
      knowledgeBases.create({
        workspaceId: workspace.id,
        name: 'Architecture',
        description: 'Validated technical decisions',
        createdBy: createdUser.id,
      }),
    );
    expect(knowledgeBase.workspaceId).toBe(workspace.id);

    await expect(
      dataSource.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)`,
        [workspace.id, createdUser.id, 'viewer'],
      ),
    ).rejects.toMatchObject({ code: '22P02' });
    await expect(
      dataSource.query(
        `INSERT INTO knowledge_bases (workspace_id, name, created_by) VALUES ($1, $2, $3)`,
        [workspace.id, 'architecture', createdUser.id],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      dataSource.query(
        `INSERT INTO workspaces (name, created_by) VALUES ($1, $2)`,
        [' Invalid ', createdUser.id],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      dataSource.query(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)`,
        ['SECOND@example.com', 'another-test-hash'],
      ),
    ).rejects.toMatchObject({ code: '23514' });

    await expect(
      dataSource.query(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2)`,
        ['owner@example.com', 'another-test-hash'],
      ),
    ).rejects.toMatchObject({ code: '23505' });

    await expect(
      dataSource.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)`,
        ['second@example.com', 'another-test-hash', 'super_admin'],
      ),
    ).rejects.toMatchObject({ code: '22P02' });

    await dataSource.undoLastMigration();

    const retrievalRevertedState = await dataSource.query<
      Array<{ chunks_table: string | null }>
    >(`SELECT to_regclass('public.document_chunks')::text AS chunks_table`);
    expect(retrievalRevertedState).toEqual([{ chunks_table: null }]);

    await dataSource.undoLastMigration();

    const documentRevertedState = await dataSource.query<
      Array<{
        documents_table: string | null;
        document_version_status_count: number;
      }>
    >(
      `SELECT
         to_regclass('public.documents')::text AS documents_table,
         (SELECT COUNT(*)::int FROM pg_type WHERE typname = 'document_version_status') AS document_version_status_count`,
    );
    expect(documentRevertedState).toEqual([
      { documents_table: null, document_version_status_count: 0 },
    ]);
    await dataSource.undoLastMigration();

    const workspaceRevertedState = await dataSource.query<
      Array<{ workspaces_table: string | null; workspace_role_count: number }>
    >(
      `SELECT
         to_regclass('public.workspaces')::text AS workspaces_table,
         (SELECT COUNT(*)::int FROM pg_type WHERE typname = 'workspace_role') AS workspace_role_count`,
    );
    expect(workspaceRevertedState).toEqual([
      { workspaces_table: null, workspace_role_count: 0 },
    ]);
    await dataSource.undoLastMigration();

    const revertedState = await dataSource.query<
      Array<{ users_table: string | null; role_type_count: number }>
    >(
      `SELECT
         to_regclass('public.users')::text AS users_table,
         (SELECT COUNT(*)::int FROM pg_type WHERE typname = 'user_role') AS role_type_count`,
    );
    expect(revertedState).toEqual([{ users_table: null, role_type_count: 0 }]);

    const extensionAfterRevert = await dataSource.query<
      Array<{ extversion: string }>
    >(`SELECT extversion FROM pg_extension WHERE extname = 'vector'`);
    expect(extensionAfterRevert).toEqual([{ extversion: '0.8.5' }]);

    const reappliedMigrations = await dataSource.runMigrations();
    expect(reappliedMigrations).toHaveLength(4);

    const nestModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              DATABASE_URL: container.getConnectionUri(),
              JWT_ACCESS_SECRET: '0123456789abcdef0123456789abcdef',
              JWT_REFRESH_SECRET: 'fedcba9876543210fedcba9876543210',
            }),
          ],
        }),
        DatabaseModule,
        AuthModule,
      ],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue({ status: 'end', disconnect: jest.fn() })
      .compile();

    const app: INestApplication<App> = nestModule.createNestApplication();
    configureApp(app);
    await app.init();

    try {
      const nestDataSource = nestModule.get(DataSource);
      expect(nestDataSource.isInitialized).toBe(true);
      await expect(nestDataSource.query('SELECT 1')).resolves.toEqual([
        { '?column?': 1 },
      ]);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'owner@example.com',
          password: 'correct horse battery staple',
          role: 'admin',
        })
        .expect(422);
      await expect(
        nestDataSource.query(`SELECT COUNT(*)::int AS count FROM users`),
      ).resolves.toEqual([{ count: 0 }]);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: '  Owner@Example.COM ',
          password: 'correct horse battery staple',
        })
        .expect(201)
        .expect((response) => {
          expect(response.body).toMatchObject({
            email: 'owner@example.com',
            role: UserRole.USER,
          });
          expect(response.body).not.toHaveProperty('passwordHash');
        });

      const storedIdentity = await nestDataSource.query<
        Array<{ email: string; password_hash: string; role: string }>
      >(`SELECT email, password_hash, role FROM users`);
      expect(storedIdentity).toHaveLength(1);
      expect(storedIdentity[0]).toMatchObject({
        email: 'owner@example.com',
        role: UserRole.USER,
      });
      expect(storedIdentity[0].password_hash).toMatch(/^\$argon2id\$/);
      expect(storedIdentity[0].password_hash).not.toContain(
        'correct horse battery staple',
      );

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'owner@example.com',
          password: 'another correct horse battery staple',
        })
        .expect(409)
        .expect({
          error: {
            code: 'IDENTITY_CONFLICT',
            message: 'An account with this email already exists',
          },
        });
    } finally {
      await app.close();
    }
  });
});
