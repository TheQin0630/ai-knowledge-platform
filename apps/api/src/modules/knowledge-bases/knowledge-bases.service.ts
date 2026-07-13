import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { KnowledgeBase } from './entities/knowledge-base.entity';

export interface KnowledgeBaseView {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeBaseManagers = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
] as const;

@Injectable()
export class KnowledgeBasesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(KnowledgeBase)
    private readonly knowledgeBases: Repository<KnowledgeBase>,
    private readonly access: WorkspaceAccessService,
  ) {}

  async list(
    workspaceId: string,
    userId: string,
  ): Promise<KnowledgeBaseView[]> {
    await this.access.requireMembership(workspaceId, userId);
    return this.knowledgeBases.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(
    workspaceId: string,
    userId: string,
    input: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseView> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.access.requireMembership(
          workspaceId,
          userId,
          knowledgeBaseManagers,
          manager,
        );
        const saved = await manager.getRepository(KnowledgeBase).save(
          manager.getRepository(KnowledgeBase).create({
            workspaceId,
            name: input.name,
            description: input.description ?? null,
            createdBy: userId,
          }),
        );
        return toView(saved);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          error: {
            code: 'KNOWLEDGE_BASE_CONFLICT',
            message: 'A knowledge base with this name already exists',
          },
        });
      }
      throw error;
    }
  }
}

function toView(knowledgeBase: KnowledgeBase): KnowledgeBaseView {
  return {
    id: knowledgeBase.id,
    workspaceId: knowledgeBase.workspaceId,
    name: knowledgeBase.name,
    description: knowledgeBase.description,
    createdAt: knowledgeBase.createdAt,
    updatedAt: knowledgeBase.updatedAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: unknown }).code === '23505'
  );
}
