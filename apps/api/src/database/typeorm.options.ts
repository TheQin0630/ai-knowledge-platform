import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { InitialPersistence1783692000000 } from './migrations/1783692000000-initial-persistence';
import { WorkspacesAndKnowledgeBases1783941600000 } from './migrations/1783941600000-workspaces-and-knowledge-bases';
import { User } from '../modules/identity/entities/user.entity';
import { KnowledgeBase } from '../modules/knowledge-bases/entities/knowledge-base.entity';
import { Workspace } from '../modules/workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../modules/workspaces/entities/workspace-member.entity';

function createDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [User, Workspace, WorkspaceMember, KnowledgeBase],
    migrations: [
      InitialPersistence1783692000000,
      WorkspacesAndKnowledgeBases1783941600000,
    ],
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
}

export function createNestTypeOrmOptions(
  databaseUrl: string,
): TypeOrmModuleOptions {
  return {
    ...createDataSourceOptions(databaseUrl),
    autoLoadEntities: true,
    retryAttempts: 3,
    retryDelay: 1_000,
    verboseRetryLog: false,
  };
}

export function createPersistenceDataSource(databaseUrl: string): DataSource {
  return new DataSource(createDataSourceOptions(databaseUrl));
}
