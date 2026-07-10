import { ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisSessionStore } from './redis-session.store';

describe('RedisSessionStore availability boundary', () => {
  const set = jest.fn();
  const get = jest.fn();
  const evalScript = jest.fn();
  const del = jest.fn();
  const redis = {
    set,
    get,
    eval: evalScript,
    del,
  } as unknown as Redis;
  const sessions = new RedisSessionStore(redis);
  const session = {
    sessionId: '42f1d65e-f1ba-49d7-a1d1-9bb756d8f15f',
    userId: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
    refreshTokenDigest: 'digest',
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it.each([
    ['create', set, () => sessions.create(session, 3_600)],
    ['get', get, () => sessions.get(session.sessionId)],
    [
      'rotate',
      evalScript,
      () =>
        sessions.rotate(
          session.sessionId,
          session.userId,
          'current-digest',
          'next-digest',
          3_600,
        ),
    ],
    ['revoke', del, () => sessions.revoke(session.sessionId)],
  ])('maps a Redis %s failure to a sanitized 503', async (_, command, act) => {
    command.mockRejectedValueOnce(
      new Error('NOAUTH sensitive-redis-connection-detail'),
    );

    let thrown: unknown;
    try {
      await act();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toEqual({
      error: {
        code: 'AUTH_SESSION_UNAVAILABLE',
        message: 'Authentication session service is unavailable',
      },
    });
    expect(JSON.stringify(thrown)).not.toContain(
      'sensitive-redis-connection-detail',
    );
  });

  it('does not swallow a Redis failure while removing invalid session state', async () => {
    get.mockResolvedValueOnce(
      JSON.stringify({ ...session, sessionId: 'wrong-session-id' }),
    );
    del.mockRejectedValueOnce(
      new Error('NOAUTH sensitive-redis-connection-detail'),
    );

    await expect(sessions.get(session.sessionId)).rejects.toMatchObject({
      response: {
        error: {
          code: 'AUTH_SESSION_UNAVAILABLE',
          message: 'Authentication session service is unavailable',
        },
      },
    });
    expect(del).toHaveBeenCalledTimes(1);
  });
});
