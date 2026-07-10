import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UserRole } from '../src/modules/identity/entities/user.entity';

describe('Registration contract (e2e)', () => {
  const register = jest.fn();
  let app: INestApplication<App>;

  beforeEach(async () => {
    register.mockReset().mockResolvedValue({
      id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
      email: 'owner@example.com',
      role: UserRole.USER,
      createdAt: '2026-07-10T00:00:00.000Z',
    });

    const moduleFixture = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { register } }],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a normalized least-privileged identity', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: '  Owner@Example.COM ',
        password: 'correct horse battery staple',
      })
      .expect(201)
      .expect({
        id: '6ac80d20-3e9d-4f1d-a98d-807aca81b28f',
        email: 'owner@example.com',
        role: 'user',
        createdAt: '2026-07-10T00:00:00.000Z',
      });

    expect(register).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
    });
  });

  it.each([
    {
      body: {
        email: 'owner@example.com',
        password: 'correct horse battery staple',
        role: 'admin',
      },
      field: 'role',
    },
    {
      body: { email: 'owner@example.com', password: 'too-short' },
      field: 'password',
    },
  ])('rejects invalid public field $field', async ({ body, field }) => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(body)
      .expect(422)
      .expect({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: { fields: [field] },
        },
      });

    expect(register).not.toHaveBeenCalled();
  });
});
