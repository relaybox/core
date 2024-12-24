import { HttpMiddleware, ParsedHttpRequest } from '@/lib/middleware';
import Services from '@/lib/services';
import { getRoomsByClientId } from '@/modules/room/room.service';
import { getErrorResponse, getSuccessResponse } from '@/util/http';
import { getLogger } from '@/util/logger';
import { HttpResponse } from 'uWebSockets.js';

const logger = getLogger('room-list');

const DEFAULT_RESULTS_OFFSET = 0;
const DEFAULT_RESULTS_LIMIT = 10;

export function handler({ pgPool }: Services): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest) => {
    const pgClient = await pgPool!.connect();

    try {
      const { appPid, clientId } = req.auth;
      const { offset, limit } = req.query;

      const rooms = await getRoomsByClientId(
        logger,
        pgClient,
        appPid,
        clientId,
        Number(offset || DEFAULT_RESULTS_OFFSET),
        Number(limit || DEFAULT_RESULTS_LIMIT)
      );

      res.cork(() => getSuccessResponse(res, rooms));
    } catch (err: unknown) {
      logger.error(`Failed to get room history messages`, { err });
      res.cork(() => getErrorResponse(res, err));
    } finally {
      pgClient.release();
    }
  };
}
