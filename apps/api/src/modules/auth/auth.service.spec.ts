import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';

describe('AuthService.register', () => {
  const create = jest.fn();
  const save = jest.fn();
  const users = { create, save } as unknown as Repository<User>;
  const hasher = {
    hash: jest.fn(),
    verify: jest.fn(),
  } as unknown as Argon2PasswordHasher;
  const service = new AuthService(users, hasher);

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
