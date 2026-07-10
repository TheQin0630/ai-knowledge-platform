import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { RedisSessionStore } from '../src/modules/auth/session/redis-session.store';

jest.setTimeout(120_000);

describe('RedisSessionStore', () => {
  let container: StartedRedisContainer;
  let redis: Redis;
  let sessions: RedisSessionStore;

  beforeAll(async () => {
    container = await new RedisContainer('redis:8.4.4-alpine')
      .withPassword('integration-test-password')
      .start();
    redis = new Redis(container.getConnectionUrl(), {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
    await expect(redis.ping()).resolves.toBe('PONG');
    sessions = new RedisSessionStore(redis);
  });

  afterEach(async () => {
    await redis.flushdb();
  });

  afterAll(async () => {
    await redis.quit();
    await container.stop();
  });

  it('creates a bounded session and rotates the refresh digest once', async () => {
    const sessionId = '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f';
    const userId = '6ac80d20-3e9d-4f1d-a98d-807aca81b28f';

    await sessions.create(
      {
        sessionId,
        userId,
        refreshTokenDigest: 'old-digest',
      },
      3_600,
    );

    await expect(sessions.get(sessionId)).resolves.toEqual({
      sessionId,
      userId,
      refreshTokenDigest: 'old-digest',
    });
    await expect(
      redis.ttl(`auth:session:${sessionId}`),
    ).resolves.toBeGreaterThan(3_590);
    await expect(
      sessions.rotate(sessionId, userId, 'old-digest', 'new-digest', 3_600),
    ).resolves.toBe('rotated');
    await expect(sessions.get(sessionId)).resolves.toMatchObject({
      refreshTokenDigest: 'new-digest',
    });

    await expect(
      sessions.rotate(sessionId, userId, 'old-digest', 'attacker', 3_600),
    ).resolves.toBe('replay');
    await expect(sessions.get(sessionId)).resolves.toBeNull();
  });

  it('revokes a session when its user binding does not match', async () => {
    const sessionId = '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f';
    await sessions.create(
      {
        sessionId,
        userId: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
        refreshTokenDigest: 'digest',
      },
      3_600,
    );

    await expect(
      sessions.rotate(
        sessionId,
        '24924a67-4a89-4372-a3e3-e00f06e4c595',
        'digest',
        'new-digest',
        3_600,
      ),
    ).resolves.toBe('replay');
    await expect(sessions.get(sessionId)).resolves.toBeNull();
  });

  it('revokes idempotently', async () => {
    const sessionId = '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f';
    await sessions.create(
      {
        sessionId,
        userId: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
        refreshTokenDigest: 'digest',
      },
      3_600,
    );

    await sessions.revoke(sessionId);
    await sessions.revoke(sessionId);
    await expect(sessions.get(sessionId)).resolves.toBeNull();
  });
});
