import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { EnvironmentVariables } from '../../../config/environment.schema';
import { UserRole } from '../../identity/entities/user.entity';
import { AuthTokenService } from './auth-token.service';

const accessSecret = '0123456789abcdef0123456789abcdef';
const refreshSecret = 'fedcba9876543210fedcba9876543210';

describe('AuthTokenService', () => {
  const jwtService = new JwtService();
  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      if (key === 'JWT_ACCESS_SECRET') return accessSecret;
      if (key === 'JWT_REFRESH_SECRET') return refreshSecret;
      throw new Error(`Unexpected configuration key: ${key}`);
    }),
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const tokens = new AuthTokenService(jwtService, configService);
  const identity = {
    userId: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
    sessionId: '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
    role: UserRole.USER,
  };

  it('issues and verifies purpose-bound access and refresh tokens', async () => {
    const pair = await tokens.issuePair(identity);

    await expect(tokens.verifyAccess(pair.accessToken)).resolves.toMatchObject({
      sub: identity.userId,
      sid: identity.sessionId,
      purpose: 'access',
      role: UserRole.USER,
    });
    await expect(
      tokens.verifyRefresh(pair.refreshToken),
    ).resolves.toMatchObject({
      sub: identity.userId,
      sid: identity.sessionId,
      purpose: 'refresh',
      role: UserRole.USER,
    });
    expect(pair.accessExpiresIn).toBe(900);
    expect(pair.refreshExpiresIn).toBe(604_800);
  });

  it('rejects token-purpose confusion in both directions', async () => {
    const pair = await tokens.issuePair(identity);

    await expect(tokens.verifyAccess(pair.refreshToken)).rejects.toThrow();
    await expect(tokens.verifyRefresh(pair.accessToken)).rejects.toThrow();
  });

  it('rejects forged and expired access tokens', async () => {
    const forged = await jwtService.signAsync(
      {
        sub: identity.userId,
        sid: identity.sessionId,
        jti: randomUUID(),
        purpose: 'access',
        role: UserRole.USER,
      },
      {
        secret: Buffer.from('wrong-secret-wrong-secret-wrong-secret'),
        algorithm: 'HS256',
        issuer: 'ai-knowledge-platform',
        audience: 'ai-knowledge-api',
        expiresIn: 900,
      },
    );
    const expired = await jwtService.signAsync(
      {
        sub: identity.userId,
        sid: identity.sessionId,
        jti: randomUUID(),
        purpose: 'access',
        role: UserRole.USER,
      },
      {
        secret: Buffer.from(accessSecret),
        algorithm: 'HS256',
        issuer: 'ai-knowledge-platform',
        audience: 'ai-knowledge-api',
        expiresIn: -1,
      },
    );

    await expect(tokens.verifyAccess(forged)).rejects.toThrow();
    await expect(tokens.verifyAccess(expired)).rejects.toThrow();
  });

  it('rejects tokens with the wrong algorithm, issuer, audience, or no expiry', async () => {
    const claims = {
      sub: identity.userId,
      sid: identity.sessionId,
      jti: randomUUID(),
      purpose: 'access',
      role: UserRole.USER,
    };
    const invalidTokens = await Promise.all([
      jwtService.signAsync(claims, {
        secret: Buffer.from(accessSecret),
        algorithm: 'HS384',
        issuer: 'ai-knowledge-platform',
        audience: 'ai-knowledge-api',
        expiresIn: 900,
      }),
      jwtService.signAsync(claims, {
        secret: Buffer.from(accessSecret),
        algorithm: 'HS256',
        issuer: 'attacker-controlled-issuer',
        audience: 'ai-knowledge-api',
        expiresIn: 900,
      }),
      jwtService.signAsync(claims, {
        secret: Buffer.from(accessSecret),
        algorithm: 'HS256',
        issuer: 'ai-knowledge-platform',
        audience: 'attacker-controlled-audience',
        expiresIn: 900,
      }),
      jwtService.signAsync(claims, {
        secret: Buffer.from(accessSecret),
        algorithm: 'HS256',
        issuer: 'ai-knowledge-platform',
        audience: 'ai-knowledge-api',
      }),
    ]);

    for (const token of invalidTokens) {
      await expect(tokens.verifyAccess(token)).rejects.toThrow();
    }
  });

  it('rejects signed payloads with malformed identity claims', async () => {
    const malformed = await jwtService.signAsync(
      {
        sub: 'not-a-uuid',
        sid: identity.sessionId,
        jti: randomUUID(),
        purpose: 'access',
        role: UserRole.USER,
      },
      {
        secret: Buffer.from(accessSecret),
        algorithm: 'HS256',
        issuer: 'ai-knowledge-platform',
        audience: 'ai-knowledge-api',
        expiresIn: 900,
      },
    );

    await expect(tokens.verifyAccess(malformed)).rejects.toThrow(
      'Invalid token claims',
    );
  });
});
