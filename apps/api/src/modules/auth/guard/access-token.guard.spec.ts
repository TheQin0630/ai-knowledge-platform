import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../../identity/entities/user.entity';
import { AuthSession, RedisSessionStore } from '../session/redis-session.store';
import { AuthTokenClaims, AuthTokenService } from '../token/auth-token.service';
import { AccessTokenGuard, AuthenticatedRequest } from './access-token.guard';

describe('AccessTokenGuard', () => {
  const verifyAccess = jest.fn<Promise<AuthTokenClaims>, [string]>();
  const tokens = { verifyAccess } as unknown as AuthTokenService;
  const getSession = jest.fn<Promise<AuthSession | null>, [string]>();
  const revokeSession = jest.fn<Promise<void>, [string]>();
  const sessions = {
    get: getSession,
    revoke: revokeSession,
  } as unknown as RedisSessionStore;
  const guard = new AccessTokenGuard(tokens, sessions);
  const claims: AuthTokenClaims = {
    sub: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
    sid: '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
    jti: '24924a67-4a89-4372-a3e3-e00f06e4c595',
    purpose: 'access',
    role: UserRole.USER,
    iat: 1_784_000_000,
    exp: 1_784_000_900,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('authorizes an access token bound to an active session', async () => {
    const { context, request } = createContext('Bearer access-token');
    verifyAccess.mockResolvedValue(claims);
    getSession.mockResolvedValue({
      sessionId: claims.sid,
      userId: claims.sub,
      refreshTokenDigest: 'digest',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect((request as AuthenticatedRequest).auth).toEqual({
      userId: claims.sub,
      sessionId: claims.sid,
      role: UserRole.USER,
    });
  });

  it.each([
    undefined,
    '',
    'Basic credentials',
    'Bearer',
    'Bearer token with spaces',
  ])('rejects malformed Authorization value %p', async (authorization) => {
    const { context } = createContext(authorization);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: invalidAccessResponse,
    });
    expect(verifyAccess).not.toHaveBeenCalled();
  });

  it('normalizes forged, expired, and wrong-purpose verification failures', async () => {
    const { context } = createContext('Bearer invalid-token');
    verifyAccess.mockRejectedValue(new Error('sensitive JWT detail'));

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: invalidAccessResponse,
    });
    expect(getSession).not.toHaveBeenCalled();
  });

  it('rejects an access token after its session has been revoked', async () => {
    const { context } = createContext('Bearer logged-out-access-token');
    verifyAccess.mockResolvedValue(claims);
    getSession.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not disguise a Redis failure as an invalid access token', async () => {
    const { context } = createContext('Bearer access-token');
    const redisFailure = new ServiceUnavailableException({
      error: {
        code: 'AUTH_SESSION_UNAVAILABLE',
        message: 'Authentication session service is unavailable',
      },
    });
    verifyAccess.mockResolvedValue(claims);
    getSession.mockRejectedValue(redisFailure);

    await expect(guard.canActivate(context)).rejects.toBe(redisFailure);
  });

  it('revokes and rejects a session whose user binding is inconsistent', async () => {
    const { context } = createContext('Bearer access-token');
    verifyAccess.mockResolvedValue(claims);
    getSession.mockResolvedValue({
      sessionId: claims.sid,
      userId: 'e1eeb682-a168-4e90-98e3-8dd75320b1ec',
      refreshTokenDigest: 'digest',
    });
    revokeSession.mockResolvedValue();

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: invalidAccessResponse,
    });
    expect(revokeSession).toHaveBeenCalledWith(claims.sid);
  });
});

const invalidAccessResponse = {
  error: {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Access token is invalid or expired',
  },
};

function createContext(authorization: string | undefined): {
  context: ExecutionContext;
  request: Request;
} {
  const request = {
    headers: authorization === undefined ? {} : { authorization },
  } as Request;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}
