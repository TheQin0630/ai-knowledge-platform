import { ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { LoginAttemptLimiter } from './login-attempt-limiter';

describe('LoginAttemptLimiter', () => {
  const evalScript = jest.fn<
    Promise<unknown>,
    [string, number, string, string, string, string, string]
  >();
  const redis = { eval: evalScript } as unknown as Redis;
  const limiter = new LoginAttemptLimiter(redis);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('allows an attempt below both limits without storing PII in keys', async () => {
    evalScript.mockResolvedValueOnce([1, 0]);

    await expect(
      limiter.consume({
        sourceAddress: '203.0.113.10',
        email: 'Owner@Example.COM',
      }),
    ).resolves.toEqual({ allowed: true });

    expect(evalScript).toHaveBeenCalledWith(
      expect.any(String),
      2,
      expect.stringMatching(/^auth:login-limit:ip:[0-9a-f]{64}$/),
      expect.stringMatching(/^auth:login-limit:pair:[0-9a-f]{64}$/),
      '30',
      '10',
      '900',
    );
    expect(JSON.stringify(evalScript.mock.calls[0])).not.toContain(
      'Owner@Example.COM',
    );
    expect(JSON.stringify(evalScript.mock.calls[0])).not.toContain(
      '203.0.113.10',
    );
  });

  it('normalizes email before deriving the pair key', async () => {
    evalScript.mockResolvedValue([1, 0]);

    await limiter.consume({
      sourceAddress: '203.0.113.10',
      email: ' Owner@Example.COM ',
    });
    await limiter.consume({
      sourceAddress: '203.0.113.10',
      email: 'owner@example.com',
    });

    expect(evalScript.mock.calls[0][3]).toBe(evalScript.mock.calls[1][3]);
  });

  it('returns the retry window when either limit is exceeded', async () => {
    evalScript.mockResolvedValueOnce([0, 317]);

    await expect(
      limiter.consume({
        sourceAddress: '203.0.113.10',
        email: 'owner@example.com',
      }),
    ).resolves.toEqual({ allowed: false, retryAfterSeconds: 317 });
  });

  it.each([
    new Error('NOAUTH sensitive-redis-connection-detail'),
    ['unexpected-result'],
  ])('maps Redis failure %p to a sanitized 503', async (failure) => {
    if (failure instanceof Error) {
      evalScript.mockRejectedValueOnce(failure);
    } else {
      evalScript.mockResolvedValueOnce(failure);
    }

    let thrown: unknown;
    try {
      await limiter.consume({
        sourceAddress: '203.0.113.10',
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
    expect(JSON.stringify(thrown)).not.toContain(
      'sensitive-redis-connection-detail',
    );
  });
});
