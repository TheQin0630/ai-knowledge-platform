import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const query = jest.fn();
  const dataSource = { query } as unknown as DataSource;
  const controller = new HealthController(dataSource);

  beforeEach(() => {
    query.mockReset();
  });

  it('reports that the process is alive', () => {
    expect(controller.getLiveness()).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('reports ready when PostgreSQL responds', async () => {
    query.mockResolvedValueOnce([{ result: 1 }]);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ok',
      dependencies: { postgres: 'up' },
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
      dependencies: { postgres: 'down' },
    });
    expect(JSON.stringify((thrown as Error).message)).not.toContain(
      'do-not-expose',
    );
  });
});
