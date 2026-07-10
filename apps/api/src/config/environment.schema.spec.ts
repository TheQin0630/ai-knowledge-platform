import { validateEnvironment } from './environment.schema';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/ai_knowledge',
  REDIS_URL: 'redis://:password@localhost:6379/0',
  JWT_SECRET: '0123456789abcdef0123456789abcdef',
};

describe('environmentValidationSchema', () => {
  it('accepts a complete environment and converts the port', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3000);
  });

  it('rejects missing service URLs and JWT secret', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', PORT: '3000' }),
    ).toThrow(/DATABASE_URL.*REDIS_URL.*JWT_SECRET/);
  });

  it('rejects short JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(/length must be at least 32 characters long/);
  });

  it('rejects the documented placeholder JWT secret', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_SECRET: 'replace-with-at-least-32-random-bytes',
      }),
    ).toThrow(/contains an invalid value/);
  });
});
