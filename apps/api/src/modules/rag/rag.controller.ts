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
import { AskKnowledgeBaseDto } from './dto/ask-knowledge-base.dto';
import { RagService } from './rag.service';

@Controller('workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/answers')
@UseGuards(AccessTokenGuard)
export class RagController {
  constructor(private readonly rag: RagService) {}

  @Post()
  @HttpCode(200)
  ask(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: AskKnowledgeBaseDto,
  ) {
    return this.rag.ask(
      workspaceId,
      knowledgeBaseId,
      request.auth.userId,
      body.question.trim(),
    );
  }
}
