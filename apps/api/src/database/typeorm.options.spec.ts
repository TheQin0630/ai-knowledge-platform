import { User } from '../modules/identity/entities/user.entity';
import { InitialPersistence1783692000000 } from './migrations/1783692000000-initial-persistence';
import {
  createNestTypeOrmOptions,
  createPersistenceDataSource,
} from './typeorm.options';

describe('TypeORM options', () => {
  const databaseUrl =
    'postgresql://user:password@localhost:5432/ai_knowledge_test';

  it('keeps Nest startup migration-safe with bounded retries', () => {
    const options = createNestTypeOrmOptions(databaseUrl);

    expect(options).toMatchObject({
      type: 'postgres',
      url: databaseUrl,
      autoLoadEntities: true,
      retryAttempts: 3,
      retryDelay: 1_000,
      synchronize: false,
      migrationsRun: false,
      entities: [User],
      migrations: [InitialPersistence1783692000000],
    });
  });

  it('uses the same migration-safe options for the CLI data source', () => {
    const dataSource = createPersistenceDataSource(databaseUrl);

    expect(dataSource.options).toMatchObject({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      migrationsRun: false,
      entities: [User],
      migrations: [InitialPersistence1783692000000],
    });
  });
});
