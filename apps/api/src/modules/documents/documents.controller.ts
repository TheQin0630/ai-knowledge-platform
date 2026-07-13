import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../auth/guard/access-token.guard';
import type { AuthenticatedRequest } from '../auth/guard/access-token.guard';
import { MAX_DOCUMENT_SIZE } from './document-ingestion.constants';
import { DocumentsService } from './documents.service';

@Controller(
  'workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/documents',
)
@UseGuards(AccessTokenGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}
  @Get() list(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.list(
      workspaceId,
      knowledgeBaseId,
      request.auth.userId,
    );
  }
  @Get(':documentId') detail(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.detail(
      workspaceId,
      knowledgeBaseId,
      documentId,
      request.auth.userId,
    );
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_DOCUMENT_SIZE, files: 1 },
    }),
  )
  upload(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.documents.upload(
      workspaceId,
      knowledgeBaseId,
      request.auth.userId,
      file,
    );
  }
  @Post(':documentId/versions/:versionId/retry') retry(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Param('versionId', new ParseUUIDPipe()) versionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.documents.retry(
      workspaceId,
      knowledgeBaseId,
      documentId,
      versionId,
      request.auth.userId,
    );
  }
}
