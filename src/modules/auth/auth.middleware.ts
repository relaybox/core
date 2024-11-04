import { HttpMiddleware, HttpMiddlewareNext, ParsedHttpRequest } from '@/lib/middleware';
import { Pool } from 'pg';
import { HttpResponse } from 'uWebSockets.js';
import { Logger } from 'winston';
import {
  decodeAuthToken,
  getSecretKey,
  parsePublicKey,
  verifyAuthTokenSignature
} from './auth.service';
import Services from '@/lib/services';

export function verifyAuthToken(logger: Logger, { pgPool }: Services): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest, next: HttpMiddlewareNext) => {
    const pgClient = await pgPool!.connect();

    try {
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader.substring(7);

      const { publicKey } = decodeAuthToken(bearerToken);
      const { appPid, keyId } = parsePublicKey(publicKey);

      const secretKey = await getSecretKey(logger, pgClient, appPid, keyId);

      verifyAuthTokenSignature(logger, bearerToken, secretKey);

      next({ auth: { appPid, keyId } });
    } catch (err: unknown) {
      logger.error(`Failed to verify token`, { err });
      throw err;
    } finally {
      if (pgClient) {
        pgClient.release();
      }
    }
  };
}
