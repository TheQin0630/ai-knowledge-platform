import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { createPersistenceDataSource } from '../src/database/typeorm.options';
import { User, UserRole } from '../src/modules/identity/entities/user.entity';

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
    expect(appliedMigrations).toHaveLength(1);

    const extension = await dataSource.query<Array<{ extversion: string }>>(
      `SELECT extversion FROM pg_extension WHERE extname = 'vector'`,
    );
    expect(extension).toEqual([{ extversion: '0.8.5' }]);

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
    expect(reappliedMigrations).toHaveLength(1);
  });
});
