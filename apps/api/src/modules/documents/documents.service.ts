import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KnowledgeBase } from '../knowledge-bases/entities/knowledge-base.entity';
import { WorkspaceRole } from '../workspaces/entities/workspace-member.entity';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import {
  DOCUMENT_STORAGE,
  MAX_DOCUMENT_SIZE,
  supportedDocumentTypes,
} from './document-ingestion.constants';
import { DocumentQueueService } from './document-queue.service';
import type { DocumentStorage } from './document-storage.service';
import {
  DocumentVersion,
  DocumentVersionStatus,
} from './entities/document-version.entity';
import { Document } from './entities/document.entity';

const managers = [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as const;

export interface DocumentVersionView {
  id: string;
  versionNumber: number;
  mediaType: string;
  sizeBytes: number;
  status: DocumentVersionStatus;
  attemptCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface DocumentView {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  createdAt: Date;
  updatedAt: Date;
  latestVersion: DocumentVersionView;
  versions?: DocumentVersionView[];
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Document)
    private readonly documents: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versions: Repository<DocumentVersion>,
    private readonly access: WorkspaceAccessService,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly queue: DocumentQueueService,
  ) {}

  async list(
    workspaceId: string,
    knowledgeBaseId: string,
    userId: string,
  ): Promise<DocumentView[]> {
    await this.requireKnowledgeBase(workspaceId, knowledgeBaseId, userId);
    const documents = await this.documents.find({
      where: { knowledgeBaseId },
      order: { updatedAt: 'DESC' },
    });
    return Promise.all(
      documents.map(async (document) => {
        const latest = await this.versions.findOneOrFail({
          where: { documentId: document.id },
          order: { versionNumber: 'DESC' },
        });
        return toView(document, latest);
      }),
    );
  }

  async detail(
    workspaceId: string,
    knowledgeBaseId: string,
    documentId: string,
    userId: string,
  ): Promise<DocumentView> {
    await this.requireKnowledgeBase(workspaceId, knowledgeBaseId, userId);
    const document = await this.documents.findOneBy({
      id: documentId,
      knowledgeBaseId,
    });
    if (!document) throw documentNotFound();
    const versions = await this.versions.find({
      where: { documentId },
      order: { versionNumber: 'DESC' },
    });
    if (!versions[0]) throw documentNotFound();
    return {
      ...toView(document, versions[0]),
      versions: versions.map(toVersionView),
    };
  }

  async upload(
    workspaceId: string,
    knowledgeBaseId: string,
    userId: string,
    file?: Express.Multer.File,
  ): Promise<DocumentView> {
    validateFile(file);
    const fileName = decodeMultipartFileName(file.originalname);
    validateFileName(fileName);
    const mediaType = mediaTypeFor(fileName);
    validateContent(file.buffer, mediaType);
    const created = await this.dataSource.transaction(async (manager) => {
      await this.access.requireMembership(
        workspaceId,
        userId,
        managers,
        manager,
      );
      const knowledgeBase = await manager
        .getRepository(KnowledgeBase)
        .createQueryBuilder('kb')
        .setLock('pessimistic_write')
        .where('kb.id = :knowledgeBaseId AND kb.workspace_id = :workspaceId', {
          knowledgeBaseId,
          workspaceId,
        })
        .getOne();
      if (!knowledgeBase) throw knowledgeBaseNotFound();
      const repository = manager.getRepository(Document);
      let document = await repository
        .createQueryBuilder('document')
        .where('document.knowledge_base_id = :knowledgeBaseId', {
          knowledgeBaseId,
        })
        .andWhere('LOWER(document.file_name) = LOWER(:fileName)', {
          fileName,
        })
        .getOne();
      if (!document)
        document = await repository.save(
          repository.create({
            id: randomUUID(),
            knowledgeBaseId,
            fileName,
            createdBy: userId,
          }),
        );
      const versionRepository = manager.getRepository(DocumentVersion);
      const latest = await versionRepository.findOne({
        where: { documentId: document.id },
        order: { versionNumber: 'DESC' },
      });
      const version = versionRepository.create({
        id: randomUUID(),
        documentId: document.id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        objectKey: '',
        mediaType,
        sizeBytes: String(file.size),
        status: DocumentVersionStatus.QUEUED,
        extractedText: null,
        errorCode: null,
        errorMessage: null,
        attemptCount: 0,
        createdBy: userId,
      });
      version.objectKey = `workspaces/${workspaceId}/knowledge-bases/${knowledgeBaseId}/documents/${document.id}/versions/${version.id}`;
      return { document, version: await versionRepository.save(version) };
    });
    try {
      await this.storage.put(created.version.objectKey, file.buffer, mediaType);
      await this.queue.enqueue(created.version.id);
    } catch (error) {
      await this.versions.update(created.version.id, {
        status: DocumentVersionStatus.FAILED,
        errorCode: 'DOCUMENT_INGESTION_UNAVAILABLE',
        errorMessage: 'Document storage or queue is unavailable',
      });
      throw new ServiceUnavailableException(
        {
          error: {
            code: 'DOCUMENT_INGESTION_UNAVAILABLE',
            message: 'Document storage or queue is unavailable',
          },
        },
        { cause: error },
      );
    }
    return toView(created.document, created.version);
  }

  async retry(
    workspaceId: string,
    knowledgeBaseId: string,
    documentId: string,
    versionId: string,
    userId: string,
  ): Promise<DocumentVersionView> {
    await this.requireKnowledgeBase(workspaceId, knowledgeBaseId, userId, true);
    const document = await this.documents.findOneBy({
      id: documentId,
      knowledgeBaseId,
    });
    if (!document) throw documentNotFound();
    const version = await this.versions.findOneBy({
      id: versionId,
      documentId,
    });
    if (!version) throw documentNotFound();
    if (version.status !== DocumentVersionStatus.FAILED)
      throw new ConflictException({
        error: {
          code: 'DOCUMENT_RETRY_NOT_ALLOWED',
          message: 'Only failed document versions can be retried',
        },
      });
    await this.versions.update(version.id, {
      status: DocumentVersionStatus.QUEUED,
      errorCode: null,
      errorMessage: null,
    });
    try {
      await this.queue.enqueue(version.id);
    } catch (error) {
      await this.versions.update(version.id, {
        status: DocumentVersionStatus.FAILED,
        errorCode: 'DOCUMENT_QUEUE_UNAVAILABLE',
        errorMessage: 'Document queue is unavailable',
      });
      throw new ServiceUnavailableException(
        {
          error: {
            code: 'DOCUMENT_QUEUE_UNAVAILABLE',
            message: 'Document queue is unavailable',
          },
        },
        { cause: error },
      );
    }
    return toVersionView({
      ...version,
      status: DocumentVersionStatus.QUEUED,
      errorCode: null,
      errorMessage: null,
    });
  }

  private async requireKnowledgeBase(
    workspaceId: string,
    knowledgeBaseId: string,
    userId: string,
    manage = false,
  ): Promise<void> {
    await this.access.requireMembership(
      workspaceId,
      userId,
      manage ? managers : undefined,
    );
    if (
      !(await this.dataSource
        .getRepository(KnowledgeBase)
        .existsBy({ id: knowledgeBaseId, workspaceId }))
    )
      throw knowledgeBaseNotFound();
  }
}

function validateFile(
  file?: Express.Multer.File,
): asserts file is Express.Multer.File {
  if (!file)
    throw new BadRequestException({
      error: {
        code: 'DOCUMENT_FILE_REQUIRED',
        message: 'A document file is required',
      },
    });
  if (file.size < 1 || file.size > MAX_DOCUMENT_SIZE)
    throw new BadRequestException({
      error: {
        code: 'DOCUMENT_SIZE_INVALID',
        message: 'Document must be between 1 byte and 25 MB',
      },
    });
}

function validateFileName(fileName: string): void {
  if (!supportedDocumentTypes.has(extname(fileName).toLowerCase()))
    throw new BadRequestException({
      error: {
        code: 'DOCUMENT_TYPE_UNSUPPORTED',
        message: 'Supported document types are PDF, DOCX, TXT and Markdown',
      },
    });
  if (fileName.length > 255)
    throw new BadRequestException({
      error: {
        code: 'DOCUMENT_NAME_INVALID',
        message: 'Document file name must not exceed 255 characters',
      },
    });
}

export function decodeMultipartFileName(originalName: string): string {
  if ([...originalName].some((character) => character.charCodeAt(0) > 255)) {
    return originalName;
  }
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? originalName : decoded;
}
function mediaTypeFor(fileName: string): string {
  return supportedDocumentTypes.get(extname(fileName).toLowerCase())!;
}
function validateContent(buffer: Buffer, mediaType: string): void {
  const valid =
    mediaType === 'application/pdf'
      ? buffer.subarray(0, 5).toString() === '%PDF-'
      : mediaType.includes('wordprocessingml')
        ? buffer[0] === 0x50 && buffer[1] === 0x4b
        : !buffer.includes(0);
  if (!valid)
    throw new BadRequestException({
      error: {
        code: 'DOCUMENT_CONTENT_INVALID',
        message: 'File content does not match its document type',
      },
    });
}
function toVersionView(version: DocumentVersion): DocumentVersionView {
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    mediaType: version.mediaType,
    sizeBytes: Number(version.sizeBytes),
    status: version.status,
    attemptCount: version.attemptCount,
    errorCode: version.errorCode,
    errorMessage: version.errorMessage,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}
function toView(
  document: Document,
  latestVersion: DocumentVersion,
): DocumentView {
  return {
    id: document.id,
    knowledgeBaseId: document.knowledgeBaseId,
    fileName: document.fileName,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    latestVersion: toVersionView(latestVersion),
  };
}
function knowledgeBaseNotFound(): NotFoundException {
  return new NotFoundException({
    error: {
      code: 'KNOWLEDGE_BASE_NOT_FOUND',
      message: 'Knowledge base not found',
    },
  });
}
function documentNotFound(): NotFoundException {
  return new NotFoundException({
    error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' },
  });
}
