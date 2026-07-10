import { DataSource, DataSourceOptions } from 'typeorm';
import { InitialPersistence1783692000000 } from './migrations/1783692000000-initial-persistence';
import { User } from '../modules/identity/entities/user.entity';

export function createPersistenceDataSource(databaseUrl: string): DataSource {
  const options: DataSourceOptions = {
    type: 'postgres',
    url: databaseUrl,
    entities: [User],
    migrations: [InitialPersistence1783692000000],
    migrationsTableName: 'typeorm_migrations',
    migrationsRun: false,
    migrationsTransactionMode: 'all',
    synchronize: false,
    logging: false,
    invalidWhereValuesBehavior: {
      null: 'throw',
      undefined: 'throw',
    },
  };

  return new DataSource(options);
}
