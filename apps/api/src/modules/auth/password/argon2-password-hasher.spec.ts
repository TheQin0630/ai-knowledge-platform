import { Argon2PasswordHasher } from './argon2-password-hasher';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes with the OWASP Argon2id baseline', async () => {
    const encoded = await hasher.hash('correct horse battery staple');

    expect(encoded).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(
      hasher.verify(encoded, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(hasher.verify(encoded, 'wrong password')).resolves.toBe(false);
  });
});
