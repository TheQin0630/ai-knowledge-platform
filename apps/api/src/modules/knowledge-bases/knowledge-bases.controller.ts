import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guard/access-token.guard';
import type { AuthenticatedRequest } from '../auth/guard/access-token.guard';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { ConfirmDeleteDto } from '../../common/dto/confirm-delete.dto';
import { KnowledgeBasesService } from './knowledge-bases.service';

@Controller('workspaces/:workspaceId/knowledge-bases')
@UseGuards(AccessTokenGuard)
export class KnowledgeBasesController {
  constructor(private readonly knowledgeBases: KnowledgeBasesService) {}

  @Get()
  list(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.knowledgeBases.list(workspaceId, request.auth.userId);
  }

  @Post()
  create(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateKnowledgeBaseDto,
  ) {
    return this.knowledgeBases.create(workspaceId, request.auth.userId, input);
  }

  @Delete(':knowledgeBaseId')
  @HttpCode(204)
  delete(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ConfirmDeleteDto,
  ) {
    return this.knowledgeBases.delete(
      workspaceId,
      knowledgeBaseId,
      request.auth.userId,
      body.confirmName,
    );
  }
}
