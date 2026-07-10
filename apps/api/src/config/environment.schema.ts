import Joi, { ObjectSchema } from 'joi';

const documentedJwtPlaceholder = 'replace-with-at-least-32-random-bytes';

export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
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
    JWT_SECRET: Joi.string()
      .min(32)
      .invalid(documentedJwtPlaceholder)
      .required(),
  }).unknown(true);

export function validateEnvironment(
  input: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentValidationSchema.validate(input, {
    abortEarly: false,
  });

  if (result.error) {
    throw result.error;
  }

  return result.value;
}
