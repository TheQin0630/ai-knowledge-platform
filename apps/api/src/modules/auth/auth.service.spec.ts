import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';
import {
  AuthSession,
  RedisSessionStore,
  SessionRotationResult,
} from './session/redis-session.store';
import { AuthTokenService } from './token/auth-token.service';

describe('AuthService.register', () => {
  const create = jest.fn();
  const save = jest.fn();
  const users = { create, save } as unknown as Repository<User>;
  const hasher = {
    hash: jest.fn(),
    verify: jest.fn(),
  } as unknown as Argon2PasswordHasher;
  const tokens = { issuePair: jest.fn() } as unknown as AuthTokenService;
  const sessions = { create: jest.fn() } as unknown as RedisSessionStore;
  const service = new AuthService(users, hasher, tokens, sessions);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('always creates the least-privileged role and returns no password hash', async () => {
    hasher.hash = jest.fn().mockResolvedValue('argon2id-hash');
    create.mockImplementation((input: Partial<User>) => input);
    save.mockImplementation((user: User) => ({
      ...user,
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      createdAt: new Date('2026-07-10T00:00:00.000Z'),
    }));

    const result = await service.register({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
      role: UserRole.ADMIN,
    } as RegisterDto);

    expect(create).toHaveBeenCalledWith({
      email: 'owner@example.com',
      passwordHash: 'argon2id-hash',
      role: UserRole.USER,
    });
    expect(result).toEqual({
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      email: 'owner@example.com',
      role: UserRole.USER,
      createdAt: '2026-07-10T00:00:00.000Z',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('maps duplicate identities to a stable conflict response', async () => {
    hasher.hash = jest.fn().mockResolvedValue('argon2id-hash');
    create.mockImplementation((input: Partial<User>) => input);
    save.mockRejectedValue({
      code: '23505',
      constraint: 'users_email_ci_unique_idx',
      detail: 'sensitive database detail',
    });

    let thrown: unknown;
    try {
      await service.register({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ConflictException);
    expect((thrown as ConflictException).getResponse()).toEqual({
      error: {
        code: 'IDENTITY_CONFLICT',
        message: 'An account with this email already exists',
      },
    });
    expect(JSON.stringify((thrown as Error).message)).not.toContain(
      'sensitive database detail',
    );
  });
});

describe('AuthService.login', () => {
  const findOne = jest.fn();
  const users = { findOne } as unknown as Repository<User>;
  const verifyPassword = jest.fn<Promise<boolean>, [string, string]>();
  const hasher = { verify: verifyPassword } as unknown as Argon2PasswordHasher;
  const issuePair = jest.fn();
  const tokens = { issuePair } as unknown as AuthTokenService;
  const createSession = jest.fn<Promise<void>, [AuthSession, number]>();
  const sessions = { create: createSession } as unknown as RedisSessionStore;
  const service = new AuthService(users, hasher, tokens, sessions);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('creates a revocable session and returns no refresh token in the public body', async () => {
    const user = {
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      email: 'owner@example.com',
      passwordHash: 'stored-argon2id-hash',
      role: UserRole.USER,
    } as User;
    findOne.mockResolvedValue(user);
    verifyPassword.mockResolvedValue(true);
    issuePair.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessExpiresIn: 900,
      refreshExpiresIn: 604_800,
    });

    const result = await service.login({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    });

    expect(createSession).toHaveBeenCalledTimes(1);
    const [storedSession, ttlSeconds] = createSession.mock.calls[0];
    expect(storedSession.userId).toBe(user.id);
    expect(storedSession.refreshTokenDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(ttlSeconds).toBe(604_800);
    expect(result.body).toEqual({
      accessToken: 'access-token',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: user.id, email: user.email, role: UserRole.USER },
    });
    expect(result.refreshToken).toBe('refresh-token');
  });

  it.each([
    { user: null, verified: false },
    {
      user: {
        id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
        email: 'owner@example.com',
        passwordHash: 'stored-argon2id-hash',
        role: UserRole.USER,
      } as User,
      verified: false,
    },
  ])(
    'returns the same error for absent users and wrong passwords',
    async ({ user, verified }) => {
      findOne.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(verified);

      let thrown: unknown;
      try {
        await service.login({
          email: 'owner@example.com',
          password: 'wrong password still long enough',
        });
      } catch (error) {
        thrown = error;
      }

      expect(verifyPassword).toHaveBeenCalledTimes(1);
      expect(thrown).toBeInstanceOf(UnauthorizedException);
      expect((thrown as UnauthorizedException).getResponse()).toEqual({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
      expect(issuePair).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
    },
  );
});

describe('AuthService.refresh', () => {
  const users = {} as Repository<User>;
  const hasher = {} as Argon2PasswordHasher;
  const verifyRefresh = jest.fn();
  const issuePair = jest.fn();
  const tokens = {
    issuePair,
    verifyRefresh,
  } as unknown as AuthTokenService;
  const rotateSession = jest.fn<
    Promise<SessionRotationResult>,
    [string, string, string, string, number]
  >();
  const sessions = { rotate: rotateSession } as unknown as RedisSessionStore;
  const service = new AuthService(users, hasher, tokens, sessions);
  const identity = {
    userId: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
    sessionId: '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
    role: UserRole.USER,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('atomically rotates the refresh digest and returns a replacement pair', async () => {
    verifyRefresh.mockResolvedValue({
      sub: identity.userId,
      sid: identity.sessionId,
      role: identity.role,
    });
    issuePair.mockResolvedValue({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      accessExpiresIn: 900,
      refreshExpiresIn: 604_800,
    });
    rotateSession.mockResolvedValue('rotated');

    const result = await service.refresh('current-refresh-token');

    expect(issuePair).toHaveBeenCalledWith(identity);
    expect(rotateSession).toHaveBeenCalledTimes(1);
    const [sessionId, userId, currentDigest, nextDigest, ttlSeconds] =
      rotateSession.mock.calls[0];
    expect(sessionId).toBe(identity.sessionId);
    expect(userId).toBe(identity.userId);
    expect(currentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(nextDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(currentDigest).not.toBe(nextDigest);
    expect(ttlSeconds).toBe(604_800);
    expect(result).toEqual({
      body: {
        accessToken: 'next-access-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      },
      refreshToken: 'next-refresh-token',
      refreshExpiresIn: 604_800,
    });
  });

  it.each([undefined, '', 'forged-or-expired-token'])(
    'normalizes missing and invalid token failures',
    async (refreshToken) => {
      verifyRefresh.mockRejectedValue(new Error('sensitive JWT detail'));

      let thrown: unknown;
      try {
        await service.refresh(refreshToken);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(UnauthorizedException);
      expect((thrown as UnauthorizedException).getResponse()).toEqual({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired',
        },
      });
      expect(issuePair).not.toHaveBeenCalled();
      expect(rotateSession).not.toHaveBeenCalled();
    },
  );

  it.each(['missing', 'replay'] as const)(
    'rejects a %s session without returning the newly issued pair',
    async (rotationResult) => {
      verifyRefresh.mockResolvedValue({
        sub: identity.userId,
        sid: identity.sessionId,
        role: identity.role,
      });
      issuePair.mockResolvedValue({
        accessToken: 'unused-access-token',
        refreshToken: 'unused-refresh-token',
        accessExpiresIn: 900,
        refreshExpiresIn: 604_800,
      });
      rotateSession.mockResolvedValue(rotationResult);

      await expect(
        service.refresh('current-refresh-token'),
      ).rejects.toMatchObject({
        response: {
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token is invalid or expired',
          },
        },
      });
    },
  );
});

describe('AuthService.logout', () => {
  const users = {} as Repository<User>;
  const hasher = {} as Argon2PasswordHasher;
  const verifyRefresh = jest.fn();
  const tokens = { verifyRefresh } as unknown as AuthTokenService;
  const revokeSession = jest.fn<Promise<void>, [string]>();
  const sessions = { revoke: revokeSession } as unknown as RedisSessionStore;
  const service = new AuthService(users, hasher, tokens, sessions);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('revokes the session identified by a valid refresh token', async () => {
    verifyRefresh.mockResolvedValue({
      sid: '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
    });
    revokeSession.mockResolvedValue();

    await service.logout('valid-refresh-token');

    expect(revokeSession).toHaveBeenCalledWith(
      '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
    );
  });

  it.each([undefined, '', 'forged-or-expired-token'])(
    'is idempotent for missing and invalid refresh tokens',
    async (refreshToken) => {
      verifyRefresh.mockRejectedValue(new Error('sensitive JWT detail'));

      await expect(service.logout(refreshToken)).resolves.toBeUndefined();

      expect(revokeSession).not.toHaveBeenCalled();
    },
  );
});

describe('AuthService.getCurrentUser', () => {
  const findOne = jest.fn();
  const users = { findOne } as unknown as Repository<User>;
  const hasher = {} as Argon2PasswordHasher;
  const tokens = {} as AuthTokenService;
  const sessions = {} as RedisSessionStore;
  const service = new AuthService(users, hasher, tokens, sessions);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the current public identity without password state', async () => {
    findOne.mockResolvedValue({
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      email: 'owner@example.com',
      role: UserRole.USER,
      createdAt: new Date('2026-07-10T00:00:00.000Z'),
    });

    await expect(
      service.getCurrentUser('6ac80d20-3e9d-4f1d-a98d-807aca81b28f'),
    ).resolves.toEqual({
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      email: 'owner@example.com',
      role: UserRole.USER,
      createdAt: '2026-07-10T00:00:00.000Z',
    });
  });

  it('rejects a token whose identity no longer exists', async () => {
    findOne.mockResolvedValue(null);

    await expect(
      service.getCurrentUser('6ac80d20-3e9d-4f1d-a98d-807aca81b28f'),
    ).rejects.toMatchObject({ response: invalidAccessResponse });
  });
});

const invalidAccessResponse = {
  error: {
    code: 'INVALID_ACCESS_TOKEN',
    message: 'Access token is invalid or expired',
  },
};
