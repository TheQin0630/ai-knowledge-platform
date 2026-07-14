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
import { RunEvaluationDto } from './dto/run-evaluation.dto';
import { EvaluationsService } from './evaluations.service';
import { ConfirmDeleteDto } from '../../common/dto/confirm-delete.dto';

@Controller(
  'workspaces/:workspaceId/knowledge-bases/:knowledgeBaseId/evaluations',
)
@UseGuards(AccessTokenGuard)
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}
  @Get() list(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.evaluations.list(
      workspaceId,
      knowledgeBaseId,
      request.auth.userId,
    );
  }
  @Post() @HttpCode(201) run(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: RunEvaluationDto,
  ) {
    return this.evaluations.run(
      workspaceId,
      knowledgeBaseId,
      request.auth.userId,
      body,
    );
  }
  @Delete(':evaluationId')
  @HttpCode(204)
  delete(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('knowledgeBaseId', new ParseUUIDPipe()) knowledgeBaseId: string,
    @Param('evaluationId', new ParseUUIDPipe()) evaluationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ConfirmDeleteDto,
  ) {
    return this.evaluations.delete(
      workspaceId,
      knowledgeBaseId,
      evaluationId,
      request.auth.userId,
      body.confirmName,
    );
  }
}
