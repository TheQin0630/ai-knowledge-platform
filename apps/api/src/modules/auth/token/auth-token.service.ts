import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { EnvironmentVariables } from '../../../config/environment.schema';
import { UserRole } from '../../identity/entities/user.entity';

const issuer = 'ai-knowledge-platform';
const audience = 'ai-knowledge-api';
const accessExpiresIn = 900;
const refreshExpiresIn = 604_800;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type TokenPurpose = 'access' | 'refresh';

export interface AuthTokenClaims {
  sub: string;
  sid: string;
  jti: string;
  purpose: TokenPurpose;
  role: UserRole;
  iat: number;
  exp: number;
}

export interface TokenIdentity {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
}

@Injectable()
export class AuthTokenService {
  private readonly accessSecret: Buffer;
  private readonly refreshSecret: Buffer;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.accessSecret = Buffer.from(
      configService.get('JWT_ACCESS_SECRET', { infer: true }),
    );
    this.refreshSecret = Buffer.from(
      configService.get('JWT_REFRESH_SECRET', { infer: true }),
    );
  }

  async issuePair(identity: TokenIdentity): Promise<AuthTokenPair> {
    const baseClaims = {
      sub: identity.userId,
      sid: identity.sessionId,
      role: identity.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...baseClaims, jti: randomUUID(), purpose: 'access' },
        this.signOptions(this.accessSecret, accessExpiresIn),
      ),
      this.jwtService.signAsync(
        { ...baseClaims, jti: randomUUID(), purpose: 'refresh' },
        this.signOptions(this.refreshSecret, refreshExpiresIn),
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      accessExpiresIn,
      refreshExpiresIn,
    };
  }

  verifyAccess(token: string): Promise<AuthTokenClaims> {
    return this.verify(token, 'access', this.accessSecret);
  }

  verifyRefresh(token: string): Promise<AuthTokenClaims> {
    return this.verify(token, 'refresh', this.refreshSecret);
  }

  private signOptions(secret: Buffer, expiresIn: number) {
    return {
      secret,
      algorithm: 'HS256' as const,
      issuer,
      audience,
      expiresIn,
    };
  }

  private async verify(
    token: string,
    purpose: TokenPurpose,
    secret: Buffer,
  ): Promise<AuthTokenClaims> {
    const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(
      token,
      {
        secret,
        algorithms: ['HS256'],
        issuer,
        audience,
      },
    );

    if (!isValidClaims(payload, purpose)) {
      throw new UnauthorizedException('Invalid token claims');
    }

    return payload;
  }
}

function isValidClaims(
  payload: Record<string, unknown>,
  purpose: TokenPurpose,
): payload is AuthTokenClaims & Record<string, unknown> {
  return (
    typeof payload.sub === 'string' &&
    uuidPattern.test(payload.sub) &&
    typeof payload.sid === 'string' &&
    uuidPattern.test(payload.sid) &&
    typeof payload.jti === 'string' &&
    uuidPattern.test(payload.jti) &&
    payload.purpose === purpose &&
    (payload.role === UserRole.USER || payload.role === UserRole.ADMIN) &&
    typeof payload.iat === 'number' &&
    typeof payload.exp === 'number'
  );
}
