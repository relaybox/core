import { HttpResponse } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import { getErrorResponse, getSuccessResponse } from '@/util/http';
import {
  getCachedMessagesByRange,
  getMergedItems,
  getMessagesByRoomId,
  HISTORY_MAX_LIMIT,
  sortItemsByTimestamp,
  unshiftAndPop
} from './history.service';
import { Pool } from 'pg';
import { QueryOrder } from '@/util/pg-query';
import { BadRequestError } from '@/lib/errors';
import { HttpMiddleware, ParsedHttpRequest } from '@/lib/middleware';
import { RedisClient } from '@/lib/redis';

const logger = getLogger('history-http');

export function getHistoryMessages(pgPool: Pool, redisClient: RedisClient): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest) => {
    logger.debug(`Getting room history messages`);

    const pgClient = await pgPool.connect();

    try {
      const appPid = req.auth.appPid;
      const roomId = req.params[0];
      const offset = Number(req.query.offset) || 0;
      const limit = Number(req.query.limit) || HISTORY_MAX_LIMIT;
      const start = req.query.start || null;
      const end = req.query.end || null;
      const order = (req.query.order || QueryOrder.DESC) as QueryOrder;

      if (limit > HISTORY_MAX_LIMIT) {
        throw new BadRequestError(`Limit must be less than ${HISTORY_MAX_LIMIT}`);
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
        appPid,
        roomId,
        offset,
        limit,
        start,
        end,
        order
      );

      let { count, items } = result;

      const itemsSortedByTimestamp = sortItemsByTimestamp(items);

      const cachedMessagesByRange = await getCachedMessagesByRange(
        logger,
        redisClient,
        appPid,
        roomId,
        limit,
        itemsSortedByTimestamp[0].timestamp,
        end,
        order
      );

      const mergedItems = getMergedItems(items, cachedMessagesByRange, order);

      count += cachedMessagesByRange.length;

      res.cork(() =>
        getSuccessResponse(res, {
          count,
          items: mergedItems
        })
      );
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
