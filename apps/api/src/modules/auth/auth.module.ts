import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../identity/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Argon2PasswordHasher } from './password/argon2-password-hasher';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AuthController],
  providers: [AuthService, Argon2PasswordHasher],
})
export class AuthModule {}
