import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports that the process is alive', () => {
    const controller = new HealthController();

    expect(controller.getLiveness()).toEqual({ status: 'ok' });
  });
});
