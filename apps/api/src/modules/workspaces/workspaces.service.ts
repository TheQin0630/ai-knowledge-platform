import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { Workspace } from './entities/workspace.entity';
import {
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  knowledgeBaseCount: number;
  createdAt: Date;
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Workspace)
    private readonly workspaces: Repository<Workspace>,
  ) {}

  async create(
    userId: string,
    input: CreateWorkspaceDto,
  ): Promise<WorkspaceSummary> {
    return this.dataSource.transaction(async (manager) => {
      const workspace = await manager.getRepository(Workspace).save(
        manager.getRepository(Workspace).create({
          name: input.name,
          createdBy: userId,
        }),
      );
      await manager.getRepository(WorkspaceMember).save(
        manager.getRepository(WorkspaceMember).create({
          workspaceId: workspace.id,
          userId,
          role: WorkspaceRole.OWNER,
        }),
      );
      return {
        id: workspace.id,
        name: workspace.name,
        role: WorkspaceRole.OWNER,
        knowledgeBaseCount: 0,
        createdAt: workspace.createdAt,
      };
    });
  }

  async list(userId: string): Promise<WorkspaceSummary[]> {
    const rows = await this.workspaces
      .createQueryBuilder('workspace')
      .innerJoin(
        WorkspaceMember,
        'member',
        'member.workspace_id = workspace.id AND member.user_id = :userId',
        { userId },
      )
      .select('workspace.id', 'id')
      .addSelect('workspace.name', 'name')
      .addSelect('workspace.created_at', 'createdAt')
      .addSelect('member.role', 'role')
      .addSelect(
        '(SELECT COUNT(*)::int FROM knowledge_bases kb WHERE kb.workspace_id = workspace.id)',
        'knowledgeBaseCount',
      )
      .orderBy('workspace.created_at', 'ASC')
      .getRawMany<{
        id: string;
        name: string;
        role: WorkspaceRole;
        knowledgeBaseCount: number;
        createdAt: Date;
      }>();
    return rows;
  }

  async delete(
    workspaceId: string,
    userId: string,
    confirmName: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<
        Array<{
          name: string;
          role: WorkspaceRole;
          knowledge_base_count: number;
        }>
      >(
        `SELECT w.name, wm.role, (SELECT COUNT(*)::int FROM knowledge_bases kb WHERE kb.workspace_id = w.id) AS knowledge_base_count
         FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE w.id = $1 AND wm.user_id = $2 FOR UPDATE OF w`,
        [workspaceId, userId],
      );
      const workspace = rows[0];
      if (!workspace)
        throw new NotFoundException({
          error: {
            code: 'WORKSPACE_NOT_FOUND',
            message: 'Workspace not found',
          },
        });
      if (workspace.role !== WorkspaceRole.OWNER)
        throw new ConflictException({
          error: {
            code: 'WORKSPACE_DELETE_NOT_ALLOWED',
            message: 'Only the workspace owner can delete it',
          },
        });
      if (workspace.name !== confirmName)
        throw new ConflictException({
          error: {
            code: 'DELETE_CONFIRMATION_MISMATCH',
            message: 'Confirmation name does not match',
          },
        });
      if (workspace.knowledge_base_count > 0)
        throw new ConflictException({
          error: {
            code: 'WORKSPACE_NOT_EMPTY',
            message: 'Delete all knowledge bases before deleting the workspace',
          },
        });
      await manager.delete(Workspace, { id: workspaceId });
    });
  }
}
