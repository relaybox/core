import { getLogger } from '@/util/logger';
import { Session } from '@/types/session.types';
import { request } from '@/util/request';
import { Logger } from 'winston';
import { PoolClient } from 'pg';
import { TokenError, UnauthorizedError } from '@/lib/errors';
import * as db from './auth.db';
import jwt, { JsonWebTokenError } from 'jsonwebtoken';

const logger = getLogger('auth');

const RELAYBOX_AUTH_SERVICE_URL = process.env.RELAYBOX_AUTH_SERVICE_URL;

export async function verifyAuthToken(token: string, connectionId?: string): Promise<Session> {
  if (!token) {
    throw new Error('Auth token verification failed');
  }

  logger.debug('Verifying auth token', { connectionId });

  const headers = getAuthHeaders(token, connectionId);

  try {
    const { data } = await request<Session>(`${RELAYBOX_AUTH_SERVICE_URL}/validation/token`, {
      method: 'GET',
      headers
    });

    return data;
  } catch (err: any) {
    logger.error(`Auth token verification failed`, { token, err });
    throw err;
  }
}

export async function verifyApiKey(
  apiKey: string,
  clientId?: string,
  connectionId?: string
): Promise<Session> {
  if (!apiKey) {
    throw new Error('Auth api key verification failed');
  }

  logger.info('Verifying apiKey', { clientId, connectionId });

  try {
    const headers = getAuthHeaders(apiKey, connectionId, clientId);

    const { data } = await request<Session>(`${RELAYBOX_AUTH_SERVICE_URL}/validation/api-key`, {
      method: 'GET',
      headers
    });

    return data;
  } catch (err: any) {
    logger.error(`Auth api key verification failed`, { apiKey, err });
    throw err;
  }
}

export function getAuthHeaders(
  authorization: string,
  connectionId?: string,
  clientId?: string
): any {
  const headers = {
    Authorization: `Bearer ${authorization}`
  } as any;

  if (clientId) {
    headers['X-Ds-Client-Id'] = clientId;
  }

  if (connectionId) {
    headers['X-Ds-Connection-Id'] = connectionId;
  }

  return headers;
}

export async function getSecretKey(
  logger: Logger,
  pgClient: PoolClient,
  appPid: string,
  keyId: string
): Promise<string> {
  logger.debug(`Getting secret key for key id ${keyId}`);

  const { rows } = await db.getSecretKeybyKeyId(pgClient, appPid, keyId);

  if (!rows.length) {
    throw new UnauthorizedError('Secret key not found');
  }

  const secretKey = rows[0].secretKey;

  return secretKey;
}

export function verifyAuthTokenSignature(logger: Logger, token: string, secretKey: string) {
  logger.debug(`Verifying auth token signature`);

  try {
    const verifiedAuthToken = jwt.verify(token, secretKey);

    return verifiedAuthToken;
  } catch (err: unknown) {
    logger.error(`Failed to verify auth token signature`, { err });

    if (err instanceof JsonWebTokenError) {
      throw new TokenError(err.message);
    }

    throw err;
  }
}
