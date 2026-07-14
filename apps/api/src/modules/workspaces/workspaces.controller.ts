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
import { ConfirmDeleteDto } from '../../common/dto/confirm-delete.dto';
import { AccessTokenGuard } from '../auth/guard/access-token.guard';
import type { AuthenticatedRequest } from '../auth/guard/access-token.guard';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(AccessTokenGuard)
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.workspaces.list(request.auth.userId);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() input: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(request.auth.userId, input);
  }

  @Delete(':workspaceId')
  @HttpCode(204)
  delete(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Req() request: AuthenticatedRequest,
    @Body() body: ConfirmDeleteDto,
  ) {
    return this.workspaces.delete(
      workspaceId,
      request.auth.userId,
      body.confirmName,
    );
  }
}
