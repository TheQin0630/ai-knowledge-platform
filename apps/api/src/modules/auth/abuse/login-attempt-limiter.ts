import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../redis/redis.constants';

const ipAttemptLimit = 30;
const pairAttemptLimit = 10;
const windowSeconds = 15 * 60;

const consumeScript = `
local ipCount = redis.call('INCR', KEYS[1])
if ipCount == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[3])
end

local pairCount = redis.call('INCR', KEYS[2])
if pairCount == 1 then
  redis.call('EXPIRE', KEYS[2], ARGV[3])
end

local ipTtl = redis.call('TTL', KEYS[1])
if ipTtl < 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[3])
  ipTtl = tonumber(ARGV[3])
end

local pairTtl = redis.call('TTL', KEYS[2])
if pairTtl < 1 then
  redis.call('EXPIRE', KEYS[2], ARGV[3])
  pairTtl = tonumber(ARGV[3])
end

local retryAfter = 0
if ipCount > tonumber(ARGV[1]) then
  retryAfter = ipTtl
end
if pairCount > tonumber(ARGV[2]) and pairTtl > retryAfter then
  retryAfter = pairTtl
end

if retryAfter > 0 then
  return {0, retryAfter}
end
return {1, 0}
`;

export interface LoginAttempt {
  sourceAddress: string;
  email: string;
}

export type LoginLimitDecision =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterSeconds: number;
    };

@Injectable()
export class LoginAttemptLimiter {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async consume(attempt: LoginAttempt): Promise<LoginLimitDecision> {
    const sourceAddress = attempt.sourceAddress;
    const normalizedEmail = attempt.email.trim().toLowerCase();
    const ipKey = `auth:login-limit:ip:${digest(sourceAddress)}`;
    const pairKey = `auth:login-limit:pair:${digest(
      `${sourceAddress}\u0000${normalizedEmail}`,
    )}`;

    try {
      const result = await this.redis.eval(
        consumeScript,
        2,
        ipKey,
        pairKey,
        ipAttemptLimit.toString(),
        pairAttemptLimit.toString(),
        windowSeconds.toString(),
      );
      return parseDecision(result);
    } catch {
      throw rateLimitUnavailable();
    }
  }
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseDecision(value: unknown): LoginLimitDecision {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('Unexpected rate limit response');
  }

  const allowed = Number(value[0]);
  const retryAfterSeconds = Number(value[1]);
  if (
    !Number.isInteger(allowed) ||
    (allowed !== 0 && allowed !== 1) ||
    !Number.isInteger(retryAfterSeconds) ||
    retryAfterSeconds < 0 ||
    (allowed === 0 && retryAfterSeconds === 0)
  ) {
    throw new Error('Unexpected rate limit response');
  }

  return allowed === 1
    ? { allowed: true }
    : { allowed: false, retryAfterSeconds };
}

function rateLimitUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: {
      code: 'AUTH_RATE_LIMIT_UNAVAILABLE',
      message: 'Authentication rate limit service is unavailable',
    },
  });
}
