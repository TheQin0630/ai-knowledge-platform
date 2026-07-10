import { Global, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import Redis from 'ioredis';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { DatabaseModule } from './../src/database/database.module';
import { AuthModule } from './../src/modules/auth/auth.module';
import { REDIS_CLIENT } from './../src/redis/redis.constants';
import { RedisModule } from './../src/redis/redis.module';

const query = jest.fn();
const ping = jest.fn();

@Global()
@Module({
  providers: [{ provide: getDataSourceToken(), useValue: { query } }],
  exports: [getDataSourceToken()],
})
class TestDatabaseModule {}

@Module({})
class TestAuthModule {}

@Global()
@Module({
  providers: [{ provide: REDIS_CLIENT, useValue: { ping } as Partial<Redis> }],
  exports: [REDIS_CLIENT],
})
class TestRedisModule {}

describe('Health endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    query.mockReset().mockResolvedValue([{ result: 1 }]);
    ping.mockReset().mockResolvedValue('PONG');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideModule(DatabaseModule)
      .useModule(TestDatabaseModule)
      .overrideModule(AuthModule)
      .useModule(TestAuthModule)
      .overrideModule(RedisModule)
      .useModule(TestRedisModule)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('/api/v1/health/live (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' })
      .then(() => {
        expect(query).not.toHaveBeenCalled();
        expect(ping).not.toHaveBeenCalled();
      });
  });

  it('returns a server-generated request ID instead of trusting a supplied one', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .set('X-Request-Id', 'attacker-controlled-request-id')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(response.headers['x-request-id']).not.toBe(
      'attacker-controlled-request-id',
    );
  });

  it('/api/v1/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({
        status: 'ok',
        dependencies: { postgres: 'up', redis: 'up' },
      });
  });

  it('/api/v1/health/ready returns 503 without leaking database errors', async () => {
    query.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED internal-driver-detail-do-not-expose'),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503)
      .expect({
        status: 'error',
        dependencies: { postgres: 'down', redis: 'up' },
      });

    expect(JSON.stringify(response.body)).not.toContain('do-not-expose');
  });

  it('/api/v1/health/ready returns 503 without leaking Redis errors', async () => {
    ping.mockRejectedValueOnce(
      new Error('NOAUTH internal-redis-detail-do-not-expose'),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503)
      .expect({
        status: 'error',
        dependencies: { postgres: 'up', redis: 'down' },
      });

    expect(JSON.stringify(response.body)).not.toContain('do-not-expose');
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
