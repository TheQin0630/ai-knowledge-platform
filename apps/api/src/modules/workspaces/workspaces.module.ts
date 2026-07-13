import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeBasesController } from '../knowledge-bases/knowledge-bases.controller';
import { KnowledgeBase } from '../knowledge-bases/entities/knowledge-base.entity';
import { KnowledgeBasesService } from '../knowledge-bases/knowledge-bases.service';
import { Workspace } from './entities/workspace.entity';
import { WorkspaceMember } from './entities/workspace-member.entity';
import { WorkspaceAccessService } from './workspace-access.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Workspace, WorkspaceMember, KnowledgeBase]),
  ],
  controllers: [WorkspacesController, KnowledgeBasesController],
  providers: [WorkspacesService, WorkspaceAccessService, KnowledgeBasesService],
})
export class WorkspacesModule {}
