import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

const argon2idOptions = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

@Injectable()
export class Argon2PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, argon2idOptions);
  }

  verify(encodedHash: string, password: string): Promise<boolean> {
    return verify(encodedHash, password);
  }
}
