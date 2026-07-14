import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DOCUMENT_STORAGE } from '../documents/document-ingestion.constants';
import type { DocumentStorage } from '../documents/document-storage.service';
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
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
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

  async delete(
    workspaceId: string,
    knowledgeBaseId: string,
    userId: string,
    confirmName: string,
  ): Promise<void> {
    await this.access.requireMembership(
      workspaceId,
      userId,
      knowledgeBaseManagers,
    );
    const kb = await this.knowledgeBases.findOneBy({
      id: knowledgeBaseId,
      workspaceId,
    });
    if (!kb)
      throw new NotFoundException({
        error: {
          code: 'KNOWLEDGE_BASE_NOT_FOUND',
          message: 'Knowledge base not found',
        },
      });
    if (kb.name !== confirmName)
      throw new ConflictException({
        error: {
          code: 'DELETE_CONFIRMATION_MISMATCH',
          message: 'Confirmation name does not match',
        },
      });
    const keys = await this.dataSource.query<Array<{ object_key: string }>>(
      `SELECT dv.object_key FROM document_versions dv JOIN documents d ON d.id = dv.document_id WHERE d.knowledge_base_id = $1`,
      [knowledgeBaseId],
    );
    await this.storage.deleteMany(keys.map((item) => item.object_key));
    await this.knowledgeBases.delete({ id: knowledgeBaseId, workspaceId });
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
