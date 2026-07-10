import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { User, UserRole } from '../identity/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';
import { RedisSessionStore } from './session/redis-session.store';
import { AuthTokenService } from './token/auth-token.service';

const dummyPasswordHash =
  '$argon2id$v=19$m=19456,t=2,p=1$lFid7qQe0UKaw/Rlivgp5A$6y5eRY2mITMoHI0/SCVI/VpEYW5X6lUaLR4IkMAOaWE';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  body: {
    accessToken: string;
    tokenType: 'Bearer';
    expiresIn: number;
    user: Pick<PublicUser, 'id' | 'email' | 'role'>;
  };
  refreshToken: string;
  refreshExpiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly passwordHasher: Argon2PasswordHasher,
    private readonly tokens: AuthTokenService,
    private readonly sessions: RedisSessionStore,
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

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findOne({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
      },
    });
    const passwordMatches = await this.passwordHasher.verify(
      user?.passwordHash ?? dummyPasswordHash,
      input.password,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const sessionId = randomUUID();
    const pair = await this.tokens.issuePair({
      userId: user.id,
      sessionId,
      role: user.role,
    });
    await this.sessions.create(
      {
        sessionId,
        userId: user.id,
        refreshTokenDigest: digestToken(pair.refreshToken),
      },
      pair.refreshExpiresIn,
    );

    return {
      body: {
        accessToken: pair.accessToken,
        tokenType: 'Bearer',
        expiresIn: pair.accessExpiresIn,
        user: { id: user.id, email: user.email, role: user.role },
      },
      refreshToken: pair.refreshToken,
      refreshExpiresIn: pair.refreshExpiresIn,
    };
  }
}

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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
