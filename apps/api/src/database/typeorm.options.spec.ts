import { User } from '../modules/identity/entities/user.entity';
import { Document } from '../modules/documents/entities/document.entity';
import { DocumentVersion } from '../modules/documents/entities/document-version.entity';
import { KnowledgeBase } from '../modules/knowledge-bases/entities/knowledge-base.entity';
import { Workspace } from '../modules/workspaces/entities/workspace.entity';
import { WorkspaceMember } from '../modules/workspaces/entities/workspace-member.entity';
import { DocumentChunk } from '../modules/retrieval/entities/document-chunk.entity';
import { InitialPersistence1783692000000 } from './migrations/1783692000000-initial-persistence';
import { WorkspacesAndKnowledgeBases1783941600000 } from './migrations/1783941600000-workspaces-and-knowledge-bases';
import { DocumentIngestion1784029200000 } from './migrations/1784029200000-document-ingestion';
import { DocumentRetrieval1784115600000 } from './migrations/1784115600000-document-retrieval';
import { RagConversations1784202000000 } from './migrations/1784202000000-rag-conversations';
import { EvaluationRuns1784288400000 } from './migrations/1784288400000-evaluation-runs';
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
        RagConversations1784202000000,
        EvaluationRuns1784288400000,
      ],
    });
  });

  it('uses the same migration-safe options for the CLI data source', () => {
    const dataSource = createPersistenceDataSource(databaseUrl);

    expect(dataSource.options).toMatchObject({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      migrationsRun: false,
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
        RagConversations1784202000000,
        EvaluationRuns1784288400000,
      ],
    });
  });
});
