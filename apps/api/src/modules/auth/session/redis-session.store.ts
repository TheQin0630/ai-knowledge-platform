import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.constants';

const sessionPrefix = 'auth:session:';

const rotateScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 0
end

local session = cjson.decode(raw)
if session.userId ~= ARGV[1] or session.refreshTokenDigest ~= ARGV[2] then
  redis.call('DEL', KEYS[1])
  return -1
end

session.refreshTokenDigest = ARGV[3]
redis.call('SET', KEYS[1], cjson.encode(session), 'EX', ARGV[4])
return 1
`;

export interface AuthSession {
  sessionId: string;
  userId: string;
  refreshTokenDigest: string;
}

export type SessionRotationResult = 'rotated' | 'missing' | 'replay';

@Injectable()
export class RedisSessionStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(session: AuthSession, ttlSeconds: number): Promise<void> {
    assertTtl(ttlSeconds);
    const result = await this.redis.set(
      this.key(session.sessionId),
      JSON.stringify(session),
      'EX',
      ttlSeconds,
      'NX',
    );

    if (result !== 'OK') {
      throw new Error('Session identifier collision');
    }
  }

  async get(sessionId: string): Promise<AuthSession | null> {
    const key = this.key(sessionId);
    const raw = await this.redis.get(key);
    if (raw === null) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isAuthSession(parsed) || parsed.sessionId !== sessionId) {
        await this.redis.del(key);
        return null;
      }
      return parsed;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }

  async rotate(
    sessionId: string,
    userId: string,
    currentDigest: string,
    nextDigest: string,
    ttlSeconds: number,
  ): Promise<SessionRotationResult> {
    assertTtl(ttlSeconds);
    const result = Number(
      await this.redis.eval(
        rotateScript,
        1,
        this.key(sessionId),
        userId,
        currentDigest,
        nextDigest,
        ttlSeconds.toString(),
      ),
    );

    if (result === 1) return 'rotated';
    if (result === -1) return 'replay';
    return 'missing';
  }

  async revoke(sessionId: string): Promise<void> {
    await this.redis.del(this.key(sessionId));
  }

  private key(sessionId: string): string {
    return `${sessionPrefix}${sessionId}`;
  }
}

function assertTtl(ttlSeconds: number): void {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error('Session TTL must be a positive integer');
  }
}

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const session = value as Record<string, unknown>;
  return (
    typeof session.sessionId === 'string' &&
    typeof session.userId === 'string' &&
    typeof session.refreshTokenDigest === 'string'
  );
}
