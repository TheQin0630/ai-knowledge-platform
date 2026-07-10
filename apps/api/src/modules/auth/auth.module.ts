import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../identity/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';
import { AuthTokenService } from './token/auth-token.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, Argon2PasswordHasher, AuthTokenService],
})
export class AuthModule {}
