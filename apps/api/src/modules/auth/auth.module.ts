import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '../../redis/redis.module';
import { User } from '../identity/entities/user.entity';
import { LoginAttemptLimiter } from './abuse/login-attempt-limiter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccessTokenGuard } from './guard/access-token.guard';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';
import { RedisSessionStore } from './session/redis-session.store';
import { AuthTokenService } from './token/auth-token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({}),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginAttemptLimiter,
    Argon2PasswordHasher,
    AuthTokenService,
    RedisSessionStore,
    AccessTokenGuard,
  ],
})
export class AuthModule {}
