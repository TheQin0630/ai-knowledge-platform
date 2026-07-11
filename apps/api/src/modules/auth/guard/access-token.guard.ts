import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { ContextualRequest } from '../../../http/request-context';
import { UserRole } from '../../identity/entities/user.entity';
import { RedisSessionStore } from '../session/redis-session.store';
import { AuthSecurityEventLogger } from '../security/auth-security-event.logger';
import { AuthTokenService } from '../token/auth-token.service';

export interface AuthPrincipal {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends ContextualRequest {
  auth: AuthPrincipal;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: AuthTokenService,
    private readonly sessions: RedisSessionStore,
    private readonly securityEvents: AuthSecurityEventLogger,
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

    let session;
    try {
      session = await this.sessions.get(claims.sid);
    } catch (error) {
      if (hasStatus(error, HttpStatus.SERVICE_UNAVAILABLE)) {
        this.securityEvents.dependencyUnavailable(request.requestId, 'access');
      }
      throw error;
    }
    if (!session) {
      throw invalidAccessToken();
    }
    if (session.userId !== claims.sub) {
      this.securityEvents.sessionBindingMismatch(request.requestId);
      try {
        await this.sessions.revoke(claims.sid);
      } catch (error) {
        if (hasStatus(error, HttpStatus.SERVICE_UNAVAILABLE)) {
          this.securityEvents.dependencyUnavailable(
            request.requestId,
            'access',
          );
        }
        throw error;
      }
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

function hasStatus(error: unknown, status: number): boolean {
  return error instanceof HttpException && error.getStatus() === status;
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
