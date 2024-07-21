import { getLogger } from '../../util/logger';
import { Session } from '../../types/session.types';
import { request } from '../../util/request';

const logger = getLogger('auth');

const DS_AUTH_SERVICE_URL = process.env.DS_AUTH_SERVICE_URL;

export async function verifyAuthToken(token: string, connectionId?: string): Promise<Session> {
  if (!token) {
    throw new Error('Auth token verification failed');
  }

  logger.info('Verifying auth token', { connectionId });

  const headers = getAuthHeaders(token, connectionId);

  try {
    const { data } = await request<Session>(`${DS_AUTH_SERVICE_URL}/validate-token`, {
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

    const { data } = await request<Session>(`${DS_AUTH_SERVICE_URL}/validate-api-key`, {
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
