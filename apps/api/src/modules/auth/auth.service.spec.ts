import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';
import { AuthSession, RedisSessionStore } from './session/redis-session.store';
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
