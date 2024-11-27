import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const SECRET_LENGTH = 32;
const ITERATIONS = 100000;
const KEY_LENGTH = 64;

enum Encoding {
  BASE64 = 'base64',
  HEX = 'hex',
  UTF8 = 'utf-8'
}

enum Digest {
  SHA256 = 'sha256',
  SHA512 = 'sha512'
}

export function generateSecret(): string {
  return randomBytes(SECRET_LENGTH).toString(Encoding.HEX);
}

export function strongHash(password: string, salt: string): string {
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, Digest.SHA512).toString(
    Encoding.HEX
  );

  return hash;
}

export function verifyStrongHash(password: string, storedHash: string, salt: string): boolean {
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, Digest.SHA512).toString(
    Encoding.HEX
  );

  return timingSafeEqual(Buffer.from(hash, Encoding.HEX), Buffer.from(storedHash, Encoding.HEX));
}
