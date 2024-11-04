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
} from '@/modules/history/history.service';
import { BadRequestError } from '@/lib/errors';
import { HttpMiddleware, ParsedHttpRequest } from '@/lib/middleware';
import Services from '@/lib/services';

const logger = getLogger('history-get');

export function handler({ pgPool, redisClient }: Services): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest) => {
    logger.debug(`Getting room history messages`);

    const pgClient = await pgPool!.connect();

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
