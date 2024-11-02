import { HttpResponse } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import { getErrorResponse, getSuccessResponse } from '@/util/http';
import {
  getCachedMessagesForRange,
  getMergedItems,
  getMessagesByRoomId,
  getNextPageToken,
  HISTORY_MAX_LIMIT,
  parseRequestQueryParams
} from './history.service';
import { Pool } from 'pg';
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

      const { start, end, order, limit, lastItemId } = parseRequestQueryParams(req);

      if (limit > HISTORY_MAX_LIMIT) {
        throw new BadRequestError(`Limit must be less than ${HISTORY_MAX_LIMIT}`);
      }

      if (end && start && end < start) {
        throw new BadRequestError('End must be greater than start');
      }

      const items = await getMessagesByRoomId(
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

      // const { items } = result;

      const cachedMessagesForRange = await getCachedMessagesForRange(
        logger,
        redisClient,
        appPid,
        roomId,
        start,
        end,
        order,
        items
      );

      // const newCount = count + cachedMessagesForRange.length;

      const mergedItems = getMergedItems(
        logger,
        items,
        cachedMessagesForRange,
        order,
        limit,
        lastItemId
      );

      const nextPageToken = getNextPageToken(logger, mergedItems, start, end, order, limit);

      res.cork(() =>
        getSuccessResponse(res, {
          // count: newCount,
          items: mergedItems,
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
