import {
  Body,
  Controller,
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
import { AskKnowledgeBaseDto } from './dto/ask-knowledge-base.dto';
import { RagService } from './rag.service';
import { ChatCompletionService } from './chat-completion.service';

@Controller('workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/answers')
@UseGuards(AccessTokenGuard)
export class RagController {
  constructor(
    private readonly rag: RagService,
    private readonly chat: ChatCompletionService,
  ) {}

  @Get('models')
  models() {
    return this.chat.listProviders();
  }

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
      { provider: body.provider, model: body.model },
    );
  }
}
