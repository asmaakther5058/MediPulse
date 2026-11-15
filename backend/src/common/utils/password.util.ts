import * as bcrypt from 'bcrypt';

// bcrypt only uses the first 72 bytes of a password,
// so DTOs cap passwords at 72 characters.
const SALT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
