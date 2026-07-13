import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
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
}
