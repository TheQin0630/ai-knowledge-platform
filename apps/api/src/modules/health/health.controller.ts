import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('live')
  getLiveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async getReadiness(): Promise<{
    status: 'ok';
    dependencies: { postgres: 'up' };
  }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', dependencies: { postgres: 'up' } };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        dependencies: { postgres: 'down' },
      });
    }
  }
}
