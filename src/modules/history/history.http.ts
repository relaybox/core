import { HttpResponse } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import { getErrorResponse, getSuccessResponse } from '@/util/http';
import {
  // getCachedMessagesForRange,
  getMergedItems,
  getMessagesByRoomId,
  getNextPageToken,
  HISTORY_MAX_LIMIT,
  parseRequestQueryParams
} from './history.service';
import { Pool } from 'pg';
import { QueryOrder } from '@/util/pg-query';
import { BadRequestError } from '@/lib/errors';
import { HttpMiddleware, ParsedHttpRequest } from '@/lib/middleware';
import { RedisClient } from '@/lib/redis';
import { Message } from '@/types/history.types';

const logger = getLogger('history-http');

export function getHistoryMessages(pgPool: Pool, redisClient: RedisClient): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest) => {
    logger.debug(`Getting room history messages`);

    const pgClient = await pgPool.connect();

    try {
      const appPid = req.auth.appPid;
      const roomId = req.params[0];

      const { start, end, order, limit, lastItemId } = parseRequestQueryParams(req);

      if (limit > HISTORY_MAX_LIMIT) {
        throw new BadRequestError(`Limit must be less than ${HISTORY_MAX_LIMIT}`);
      }

      if (end && start && end < start) {
        throw new BadRequestError('End must be greater than start');
      }

      const result = await getMessagesByRoomId(
        logger,
        pgClient,
        appPid,
        roomId,
        start,
        end,
        order,
        limit,
        lastItemId
      );

      const { count, items } = result;

      // const index = order === QueryOrder.ASC ? items.length - 1 : 0;
      // const startFromCache = items[index]?.timestamp || start;

      // const cachedMessagesForRange = await getCachedMessagesForRange(
      //   logger,
      //   redisClient,
      //   appPid,
      //   roomId,
      //   startFromCache,
      //   end,
      //   order,
      //   limit
      // );

      const cachedMessagesForRange = [] as Message[];

      const newCount = count + cachedMessagesForRange.length;
      // const mergedItems = getMergedItems(items, cachedMessagesForRange, limit, order);
      const nextPageToken = getNextPageToken(items, start, end, order, limit);

      res.cork(() =>
        getSuccessResponse(res, {
          count: newCount,
          items: items,
          nextPageToken
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
