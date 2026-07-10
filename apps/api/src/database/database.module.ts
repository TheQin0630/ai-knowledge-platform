import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables } from '../config/environment.schema';
import { createNestTypeOrmOptions } from './typeorm.options';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvironmentVariables, true>) =>
        createNestTypeOrmOptions(
          configService.get('DATABASE_URL', { infer: true }),
        ),
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
