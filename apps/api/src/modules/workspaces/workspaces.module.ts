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
    ]),
  ],
  controllers: [
    WorkspacesController,
    KnowledgeBasesController,
    DocumentsController,
  ],
  providers: [
    WorkspacesService,
    WorkspaceAccessService,
    KnowledgeBasesService,
    DocumentsService,
    DocumentParserService,
    DocumentQueueService,
    S3DocumentStorage,
    { provide: DOCUMENT_STORAGE, useExisting: S3DocumentStorage },
  ],
})
export class WorkspacesModule {}
