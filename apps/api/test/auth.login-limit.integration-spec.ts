import { ServiceUnavailableException } from '@nestjs/common';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { LoginAttemptLimiter } from '../src/modules/auth/abuse/login-attempt-limiter';

jest.setTimeout(120_000);

describe('distributed login attempt limiting', () => {
  let container: StartedRedisContainer;
  let redis: Redis;
  let limiter: LoginAttemptLimiter;

  beforeAll(async () => {
    container = await new RedisContainer('redis:8.4.4-alpine')
      .withPassword('integration-test-password')
      .start();
    redis = createRedis(container.getConnectionUrl());
    await redis.connect();
    limiter = new LoginAttemptLimiter(redis);
  });

  afterEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
    await container.stop();
  });

  it('atomically allows only ten concurrent attempts for an IP and email pair', async () => {
    const decisions = await Promise.all(
      Array.from({ length: 12 }, () =>
        limiter.consume({
          sourceAddress: '203.0.113.10',
          email: 'owner@example.com',
        }),
      ),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(10);
    const denied = decisions.filter((decision) => !decision.allowed);
    expect(denied).toHaveLength(2);
    expect(
      denied.every(
        (decision) =>
          !decision.allowed &&
          decision.retryAfterSeconds > 0 &&
          decision.retryAfterSeconds <= 900,
      ),
    ).toBe(true);

    const keys = await redis.keys('auth:login-limit:*');
    expect(keys).toHaveLength(2);
    expect(JSON.stringify(keys)).not.toContain('203.0.113.10');
    expect(JSON.stringify(keys)).not.toContain('owner@example.com');
  });

  it('limits one source address across distinct normalized identities', async () => {
    const decisions = [];
    for (let attempt = 0; attempt < 31; attempt += 1) {
      decisions.push(
        await limiter.consume({
          sourceAddress: '203.0.113.20',
          email: `user-${attempt}@example.com`,
        }),
      );
    }

    expect(decisions.slice(0, 30).every((decision) => decision.allowed)).toBe(
      true,
    );
    expect(decisions[30]).toMatchObject({ allowed: false });
  });

  it('allows attempts again after both fixed-window keys expire', async () => {
    await expect(
      limiter.consume({
        sourceAddress: '203.0.113.30',
        email: 'owner@example.com',
      }),
    ).resolves.toEqual({ allowed: true });
    const keys = await redis.keys('auth:login-limit:*');
    await Promise.all(keys.map((key) => redis.expire(key, 1)));
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    await expect(
      limiter.consume({
        sourceAddress: '203.0.113.30',
        email: 'owner@example.com',
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it('fails closed without leaking driver details after Redis disconnects', async () => {
    const disconnectedRedis = createRedis(container.getConnectionUrl());
    await disconnectedRedis.connect();
    disconnectedRedis.disconnect();
    const disconnectedLimiter = new LoginAttemptLimiter(disconnectedRedis);

    let thrown: unknown;
    try {
      await disconnectedLimiter.consume({
        sourceAddress: '203.0.113.40',
        email: 'owner@example.com',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({
      error: {
        code: 'AUTH_RATE_LIMIT_UNAVAILABLE',
        message: 'Authentication rate limit service is unavailable',
      },
    });
    expect(JSON.stringify(thrown)).not.toContain('Connection is closed');
  });
});

function createRedis(url: string): Redis {
  return new Redis(url, {
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
}
