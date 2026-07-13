import { validateEnvironment } from './environment.schema';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/ai_knowledge',
  REDIS_URL: 'redis://:password@localhost:6379/0',
  JWT_ACCESS_SECRET: '0123456789abcdef0123456789abcdef',
  JWT_REFRESH_SECRET: 'fedcba9876543210fedcba9876543210',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'ai-knowledge-documents',
  S3_ACCESS_KEY: 'local-minio',
  S3_SECRET_KEY: 'local-minio-secret',
};

describe('environmentValidationSchema', () => {
  it('accepts a complete environment and converts the port', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result.PORT).toBe(3000);
  });

  it('rejects missing service URLs, storage settings and JWT secrets', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', PORT: '3000' }),
    ).toThrow(
      /DATABASE_URL.*REDIS_URL.*JWT_ACCESS_SECRET.*JWT_REFRESH_SECRET.*S3_ENDPOINT.*S3_BUCKET.*S3_ACCESS_KEY.*S3_SECRET_KEY/,
    );
  });

  it('rejects short JWT secrets', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'too-short',
      }),
    ).toThrow(/length must be at least 32 characters long/);
  });

  it('rejects the documented placeholder JWT secret', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_ACCESS_SECRET: 'replace-with-at-least-32-random-bytes',
      }),
    ).toThrow(/contains an invalid value/);
  });

  it('does not expose configuration values in validation errors', () => {
    expect.assertions(3);

    try {
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL:
          'postgresql://user:database-password@localhost:5432/ai_knowledge',
        REDIS_URL: 'redis://:redis-password@localhost:6379/0',
        JWT_ACCESS_SECRET: 'too-short',
      });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect(JSON.stringify(error)).not.toContain('database-password');
      expect(JSON.stringify(error)).not.toContain('redis-password');
    }
  });

  it('rejects reuse of the same secret for access and refresh tokens', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        JWT_REFRESH_SECRET: validEnvironment.JWT_ACCESS_SECRET,
      }),
    ).toThrow(/must differ/);
  });
});
