import { HttpMiddleware, HttpMiddlewareNext, ParsedHttpRequest } from '@/util/middleware';
import { Pool } from 'pg';
import { HttpResponse } from 'uWebSockets.js';
import { Logger } from 'winston';
import { getSecretKey, verifyAuthTokenSignature } from './auth.service';
import { getErrorResponse } from '@/util/http';
import jwt from 'jsonwebtoken';
import { ExtendedClientJwtPayload } from '@/types/auth.types';

export function verifyToken(logger: Logger, pgPool: Pool | null): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest, next: HttpMiddlewareNext) => {
    if (!pgPool) {
      throw new Error('Postgres pool not initialized');
    }

    const pgClient = await pgPool.connect();

    try {
      const authHeader = req.headers['authorization'];
      const bearerToken = authHeader.substring(7);

      const decodedToken = jwt.decode(bearerToken) as ExtendedClientJwtPayload;

      const [appPid, keyId] = decodedToken.publicKey.split('.');
      const secretKey = await getSecretKey(logger, pgClient, appPid, keyId);

      verifyAuthTokenSignature(logger, bearerToken, secretKey);
      next();
    } catch (err: unknown) {
      logger.error(`Failed to verify token`, { err });
      res.cork(() => getErrorResponse(res, err));
    } finally {
      if (pgClient) {
        pgClient.release();
      }
    }
  };
}
