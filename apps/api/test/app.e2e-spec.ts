import { Global, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { DatabaseModule } from './../src/database/database.module';
import { AuthModule } from './../src/modules/auth/auth.module';
import { RedisModule } from './../src/redis/redis.module';

const query = jest.fn();

@Global()
@Module({
  providers: [{ provide: getDataSourceToken(), useValue: { query } }],
  exports: [getDataSourceToken()],
})
class TestDatabaseModule {}

@Module({})
class TestAuthModule {}

@Module({})
class TestRedisModule {}

describe('Health endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    query.mockReset().mockResolvedValue([{ result: 1 }]);

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
      .then(() => expect(query).not.toHaveBeenCalled());
  });

  it('/api/v1/health/ready (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok', dependencies: { postgres: 'up' } });
  });

  it('/api/v1/health/ready returns 503 without leaking database errors', async () => {
    query.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED internal-driver-detail-do-not-expose'),
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503)
      .expect({ status: 'error', dependencies: { postgres: 'down' } });

    expect(JSON.stringify(response.body)).not.toContain('do-not-expose');
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });
});
