import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { InitialPersistence1783692000000 } from './migrations/1783692000000-initial-persistence';
import { WorkspacesAndKnowledgeBases1783941600000 } from './migrations/1783941600000-workspaces-and-knowledge-bases';
import { DocumentIngestion1784029200000 } from './migrations/1784029200000-document-ingestion';
import { DocumentRetrieval1784115600000 } from './migrations/1784115600000-document-retrieval';
import { Document } from '../modules/documents/entities/document.entity';
import { DocumentVersion } from '../modules/documents/entities/document-version.entity';
import { User } from '../modules/identity/entities/user.entity';
import { KnowledgeBase } from '../modules/knowledge-bases/entities/knowledge-base.entity';
import { Workspace } from '../modules/workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../modules/workspaces/entities/workspace-member.entity';
import { DocumentChunk } from '../modules/retrieval/entities/document-chunk.entity';

function createDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: [
      User,
      Workspace,
      WorkspaceMember,
      KnowledgeBase,
      Document,
      DocumentVersion,
      DocumentChunk,
    ],
    migrations: [
      InitialPersistence1783692000000,
      WorkspacesAndKnowledgeBases1783941600000,
      DocumentIngestion1784029200000,
      DocumentRetrieval1784115600000,
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
