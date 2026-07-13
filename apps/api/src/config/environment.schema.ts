import Joi, { ObjectSchema } from 'joi';

const documentedJwtPlaceholders = [
  'replace-with-at-least-32-random-bytes',
  'replace-with-a-different-32-byte-secret',
] as const;

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
}

const environmentValidationSchema: ObjectSchema<EnvironmentVariables> =
  Joi.object<EnvironmentVariables>({
    NODE_ENV: Joi.string()
      .valid('development', 'test', 'production')
      .default('development'),
    PORT: Joi.number().port().default(3000),
    DATABASE_URL: Joi.string()
      .uri({ scheme: ['postgresql', 'postgres'] })
      .required(),
    REDIS_URL: Joi.string()
      .uri({ scheme: ['redis', 'rediss'] })
      .required(),
    JWT_ACCESS_SECRET: Joi.string()
      .min(32)
      .invalid(...documentedJwtPlaceholders)
      .required(),
    JWT_REFRESH_SECRET: Joi.string()
      .min(32)
      .invalid(...documentedJwtPlaceholders)
      .required(),
    S3_ENDPOINT: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required(),
    S3_REGION: Joi.string().trim().min(1).default('us-east-1'),
    S3_BUCKET: Joi.string()
      .pattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
      .required(),
    S3_ACCESS_KEY: Joi.string().min(3).required(),
    S3_SECRET_KEY: Joi.string().min(8).required(),
  }).unknown(true);

export function validateEnvironment(
  input: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentValidationSchema.validate(input, {
    abortEarly: false,
  });

  if (result.error) {
    const messages = result.error.details
      .map((detail) => detail.message)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${messages}`);
  }

  if (result.value.JWT_ACCESS_SECRET === result.value.JWT_REFRESH_SECRET) {
    throw new Error(
      'Invalid environment configuration: JWT secrets must differ',
    );
  }

  return result.value;
}
