import { HttpResponse } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import { getErrorResponse, getSuccessResponse } from '@/util/http';
import { getMessagesByRoomId, HISTORY_MAX_LIMIT } from './history.service';
import { Pool } from 'pg';
import { QueryOrder } from '@/util/pg-query';
import { BadRequestError } from '@/lib/errors';
import { HttpMiddleware, ParsedHttpRequest } from '@/lib/middleware';

const logger = getLogger('history-http');

export function getHistoryMessages(pgPool: Pool): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest) => {
    const pgClient = await pgPool.connect();

    try {
      const roomId = req.params[0];
      const offset = Number(req.query.offset) || 0;
      const limit = Number(req.query.limit) || HISTORY_MAX_LIMIT;
      const start = req.query.start || null;
      const end = req.query.end || null;
      const order = (req.query.order || QueryOrder.DESC) as QueryOrder;
      const appPid = req.auth.appPid;

      if (limit > HISTORY_MAX_LIMIT) {
        throw new BadRequestError('Invalid limit parameter');
      }

      if (offset < 0) {
        throw new BadRequestError('Invalid offset parameter');
      }

      if (end && start && end < start) {
        throw new BadRequestError('End must be greater than start');
      }

      const result = await getMessagesByRoomId(
        logger,
        pgClient,
        roomId,
        appPid,
        offset,
        limit,
        start,
        end,
        order
      );

      res.cork(() => getSuccessResponse(res, result));
    } catch (err: unknown) {
      logger.error(`Failed to get room history messages`, { err });
      res.cork(() => getErrorResponse(res, err));
    } finally {
      if (pgClient) {
        pgClient.release();
      }
    }
  };
}
