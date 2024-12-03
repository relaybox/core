import { HttpMiddleware, ParsedHttpRequest } from '@/lib/middleware';
import Services from '@/lib/services';
import { getRoomsByClientId } from '@/modules/room/room.service';
import { getErrorResponse, getSuccessResponse } from '@/util/http';
import { getLogger } from '@/util/logger';
import { HttpResponse } from 'uWebSockets.js';

const logger = getLogger('room-list');

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
        Number(offset || 0),
        Number(limit || 10)
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
