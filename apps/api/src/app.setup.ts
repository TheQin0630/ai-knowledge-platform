import {
  INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import cookieParser from 'cookie-parser';
import { requestContextMiddleware } from './http/request-context';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.use(requestContextMiddleware);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      exceptionFactory: (errors: ValidationError[]) =>
        new UnprocessableEntityException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: {
              fields: errors.map(({ property }) => property).sort(),
            },
          },
        }),
    }),
  );
}
