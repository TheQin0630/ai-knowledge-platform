import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeBasesController } from '../knowledge-bases/knowledge-bases.controller';
import { KnowledgeBase } from '../knowledge-bases/entities/knowledge-base.entity';
import { KnowledgeBasesService } from '../knowledge-bases/knowledge-bases.service';
import { DocumentsController } from '../documents/documents.controller';
import { DocumentsService } from '../documents/documents.service';
import { Document } from '../documents/entities/document.entity';
import { DocumentVersion } from '../documents/entities/document-version.entity';
import { DOCUMENT_STORAGE } from '../documents/document-ingestion.constants';
import { S3DocumentStorage } from '../documents/document-storage.service';
import { DocumentParserService } from '../documents/document-parser.service';
import { DocumentQueueService } from '../documents/document-queue.service';
import { DocumentIndexService } from '../retrieval/document-index.service';
import { DocumentIndexBackfillService } from '../retrieval/document-index-backfill.service';
import { EmbeddingService } from '../retrieval/embedding.service';
import { DocumentChunk } from '../retrieval/entities/document-chunk.entity';
import { TextChunkerService } from '../retrieval/text-chunker.service';
import { RetrievalController } from '../retrieval/retrieval.controller';
import { RetrievalService } from '../retrieval/retrieval.service';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Workspace,
      WorkspaceMember,
      KnowledgeBase,
      Document,
      DocumentVersion,
      DocumentChunk,
    ]),
  ],
  controllers: [
    WorkspacesController,
    KnowledgeBasesController,
    DocumentsController,
    RetrievalController,
  ],
  providers: [
    WorkspacesService,
    WorkspaceAccessService,
    KnowledgeBasesService,
    DocumentsService,
    DocumentParserService,
    DocumentQueueService,
    TextChunkerService,
    EmbeddingService,
    DocumentIndexService,
    DocumentIndexBackfillService,
    RetrievalService,
    S3DocumentStorage,
    { provide: DOCUMENT_STORAGE, useExisting: S3DocumentStorage },
  ],
})
export class WorkspacesModule {}
