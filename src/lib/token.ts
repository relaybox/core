import jwt from 'jsonwebtoken';
import { ExtendedClientJwtPayload, TokenType } from '@/types/jwt.types';
import { Logger } from 'winston';
import { TokenError, TokenExpiredError, ValidationError } from './errors';

const JWT_ISSUER = process.env.JWT_ISSUER || '';
const JWT_HASHING_ALGORITHM = 'HS256';

export const DEFAULT_ID_TOKEN_EXPIRY_SECS = 300;
export const DEFAULT_REFRESH_TOKEN_EXPIRY_SECS = 7 * 24 * 60 * 60;
export const DEFAULT_TMP_TOKEN_EXPIRY_SECS = 120;

export function generateAuthToken(
  payload: ExtendedClientJwtPayload,
  secretKey: string,
  expiresIn: number
): string {
  return jwt.sign(payload, secretKey, {
    expiresIn,
    algorithm: JWT_HASHING_ALGORITHM,
    issuer: JWT_ISSUER
  });
}

export function decodeAuthToken(token: string): any {
  return jwt.decode(token);
}

export function verifyAuthToken(token: string, secretKey: string) {
  const payload = jwt.verify(token, secretKey, {
    algorithms: [JWT_HASHING_ALGORITHM],
    issuer: JWT_ISSUER
  });

  return payload;
}

export function getAuthToken(
  logger: Logger,
  uid: string,
  publicKey: string,
  secretKey: string,
  clientId: string,
  expiresIn: number = DEFAULT_ID_TOKEN_EXPIRY_SECS
): string {
  logger.debug(`Generating auth token`);

  const payload = {
    sub: uid,
    publicKey,
    clientId,
    tokenType: TokenType.ID_TOKEN,
    timestamp: new Date().toISOString()
  };

  try {
    return generateAuthToken(payload, secretKey, expiresIn);
  } catch (err: any) {
    logger.error(`Failed to generate token`, { err });
    throw new TokenError(`Failed to generate token, ${err.message}`);
  }
}

export async function getAuthRefreshToken(
  logger: Logger,
  uid: string,
  publicKey: string,
  secretKey: string,
  clientId: string,
  expiresIn: number = DEFAULT_REFRESH_TOKEN_EXPIRY_SECS
): Promise<any> {
  logger.debug(`Generating refresh token`);

  const payload = {
    sub: uid,
    publicKey,
    clientId,
    tokenType: TokenType.REFRESH_TOKEN,
    timestamp: new Date().toISOString()
  };

  try {
    return generateAuthToken(payload, secretKey, expiresIn);
  } catch (err: any) {
    logger.error(`Failed to generate token`, { err });
    throw new TokenError(`Failed to generate token, ${err.message}`);
  }
}

export async function getTmpToken(
  logger: Logger,
  uid: string,
  publicKey: string,
  secretKey: string,
  expiresIn: number = DEFAULT_TMP_TOKEN_EXPIRY_SECS
): Promise<any> {
  logger.debug(`Generating tmp token for mfa challenge`);

  const payload = {
    sub: uid,
    publicKey,
    tokenType: TokenType.TMP_TOKEN,
    timestamp: new Date().toISOString()
  };

  try {
    return generateAuthToken(payload, secretKey, expiresIn);
  } catch (err: any) {
    logger.error(`Failed to generate token`, { err });
    throw new TokenError(`Failed to generate token, ${err.message}`);
  }
}

export function verifyRefreshToken(token: string, secretKey: string, tokenType: string): void {
  try {
    verifyAuthToken(token, secretKey);
  } catch (err: any) {
    if (err.message.includes('expired')) {
      throw new TokenExpiredError(err.message);
    }

    throw new TokenError('Refresh token verification failed');
  }

  if (tokenType !== 'refresh_token') {
    throw new ValidationError(`Invalid token type`);
  }
}
