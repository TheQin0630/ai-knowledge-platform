import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  WorkspaceMember,
  WorkspaceRole,
} from './entities/workspace-member.entity';

@Injectable()
export class WorkspaceAccessService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly members: Repository<WorkspaceMember>,
  ) {}

  async requireMembership(
    workspaceId: string,
    userId: string,
    allowedRoles?: readonly WorkspaceRole[],
    manager?: EntityManager,
  ): Promise<WorkspaceMember> {
    const repository = manager
      ? manager.getRepository(WorkspaceMember)
      : this.members;
    const query = repository
      .createQueryBuilder('member')
      .where('member.workspace_id = :workspaceId', { workspaceId })
      .andWhere('member.user_id = :userId', { userId });
    if (manager) query.setLock('pessimistic_read');

    const membership = await query.getOne();
    if (!membership) {
      throw new NotFoundException({
        error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' },
      });
    }
    if (allowedRoles && !allowedRoles.includes(membership.role)) {
      throw new ForbiddenException({
        error: {
          code: 'WORKSPACE_PERMISSION_DENIED',
          message: 'Workspace role does not allow this action',
        },
      });
    }
    return membership;
  }
}
