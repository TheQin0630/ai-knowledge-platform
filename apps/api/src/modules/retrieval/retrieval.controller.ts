import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../auth/guard/access-token.guard';
import type { AuthenticatedRequest } from '../auth/guard/access-token.guard';
import { SearchKnowledgeBaseDto } from './dto/search-knowledge-base.dto';
import { RetrievalService } from './retrieval.service';

@Controller('workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/search')
@UseGuards(AccessTokenGuard)
export class RetrievalController {
  constructor(private readonly retrieval: RetrievalService) {}

  @Post()
  @HttpCode(200)
  search(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: SearchKnowledgeBaseDto,
  ) {
    return this.retrieval.search(
      workspaceId,
      knowledgeBaseId,
      request.auth.userId,
      body.query.trim(),
      body.limit,
    );
  }
}
