import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../../identity/entities/user.entity';
import { RedisSessionStore } from '../session/redis-session.store';
import { AuthTokenService } from '../token/auth-token.service';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthPrincipal;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly sessions: RedisSessionStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      throw invalidAccessToken();
    }

    let claims;
    try {
      claims = await this.tokens.verifyAccess(token);
    } catch {
      throw invalidAccessToken();
    }

    const session = await this.sessions.get(claims.sid);
    if (!session) {
      throw invalidAccessToken();
    }
    if (session.userId !== claims.sub) {
      await this.sessions.revoke(claims.sid);
      throw invalidAccessToken();
    }

    request.auth = {
      userId: claims.sub,
      sessionId: claims.sid,
      role: claims.role,
    };
    return true;
  }
}

function readBearerToken(
  authorization: string | undefined,
): string | undefined {
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
  return match?.[1];
}

function invalidAccessToken(): UnauthorizedException {
  return new UnauthorizedException({
    error: {
      code: 'INVALID_ACCESS_TOKEN',
      message: 'Access token is invalid or expired',
    },
  });
}
