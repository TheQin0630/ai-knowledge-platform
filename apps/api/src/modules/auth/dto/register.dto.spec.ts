import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '../../identity/entities/user.entity';
import { RegisterDto } from './register.dto';

async function validateRegistration(input: Record<string, unknown>) {
  const dto = plainToInstance(RegisterDto, input);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('RegisterDto', () => {
  it('normalizes a valid email address', async () => {
    const { dto, errors } = await validateRegistration({
      email: '  Owner@Example.COM ',
      password: 'correct horse battery staple',
    });

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('owner@example.com');
  });

  it('rejects public role assignment', async () => {
    const { errors } = await validateRegistration({
      email: 'owner@example.com',
      password: 'correct horse battery staple',
      role: UserRole.ADMIN,
    });

    expect(errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'role' })]),
    );
  });

  it('rejects passwords outside the 12 to 128 character boundary', async () => {
    const short = await validateRegistration({
      email: 'owner@example.com',
      password: 'too-short',
    });
    const long = await validateRegistration({
      email: 'owner@example.com',
      password: 'x'.repeat(129),
    });

    expect(short.errors).toHaveLength(1);
    expect(long.errors).toHaveLength(1);
  });
});
