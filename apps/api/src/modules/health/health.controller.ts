import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../redis/redis.constants';

type DependencyStatus = 'up' | 'down';

interface ReadinessDependencies {
  postgres: DependencyStatus;
  redis: DependencyStatus;
}

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  getLiveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async getReadiness(): Promise<{
    status: 'ok';
    dependencies: ReadinessDependencies;
  }> {
    const [postgresResult, redisResult] = await Promise.allSettled([
      this.dataSource.query('SELECT 1'),
      this.redis.ping(),
    ]);
    const dependencies: ReadinessDependencies = {
      postgres: postgresResult.status === 'fulfilled' ? 'up' : 'down',
      redis: redisResult.status === 'fulfilled' ? 'up' : 'down',
    };

    if (dependencies.postgres === 'down' || dependencies.redis === 'down') {
      throw new ServiceUnavailableException({
        status: 'error',
        dependencies,
      });
    }

    return { status: 'ok', dependencies };
  }
}
