import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly passwordHasher: Argon2PasswordHasher,
  ) {}

  async register(input: RegisterDto): Promise<PublicUser> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = this.users.create({
      email: input.email,
      passwordHash,
      role: UserRole.USER,
    });

    try {
      const saved = await this.users.save(user);
      return {
        id: saved.id,
        email: saved.email,
        role: saved.role,
        createdAt: saved.createdAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueEmailViolation(error)) {
        throw new ConflictException({
          error: {
            code: 'IDENTITY_CONFLICT',
            message: 'An account with this email already exists',
          },
        });
      }

      throw error;
    }
  }
}

function isUniqueEmailViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const databaseError = error as { code?: unknown; constraint?: unknown };
  return (
    databaseError.code === '23505' &&
    databaseError.constraint === 'users_email_ci_unique_idx'
  );
}
