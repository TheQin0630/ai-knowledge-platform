import { ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const query = jest.fn();
  const ping = jest.fn();
  const dataSource = { query } as unknown as DataSource;
  const redis = { ping } as unknown as Redis;
  const controller = new HealthController(dataSource, redis);

  beforeEach(() => {
    query.mockReset();
    ping.mockReset().mockResolvedValue('PONG');
  });

  it('reports that the process is alive', () => {
    expect(controller.getLiveness()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports ready when PostgreSQL and Redis respond', async () => {
    query.mockResolvedValueOnce([{ result: 1 }]);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ok',
      dependencies: { postgres: 'up', redis: 'up' },
    });
  });

  it('reports a sanitized unavailable response when PostgreSQL fails', async () => {
    query.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED internal-driver-detail-do-not-expose'),
    );

    let thrown: unknown;
    try {
      await controller.getReadiness();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      dependencies: { postgres: 'down', redis: 'up' },
    });
    expect(JSON.stringify((thrown as Error).message)).not.toContain(
      'do-not-expose',
    );
  });

  it('reports a sanitized unavailable response when Redis fails', async () => {
    query.mockResolvedValueOnce([{ result: 1 }]);
    ping.mockRejectedValueOnce(
      new Error('NOAUTH internal-redis-detail-do-not-expose'),
    );

    let thrown: unknown;
    try {
      await controller.getReadiness();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      dependencies: { postgres: 'up', redis: 'down' },
    });
    expect(JSON.stringify((thrown as Error).message)).not.toContain(
      'do-not-expose',
    );
  });
});
