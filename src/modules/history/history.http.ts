import { getRedisClient } from '../../lib/redis';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import * as historyService from './history.service';
import { getLogger } from '../../util/logger';
import { getJsonResponse } from '../../util/http';
import { HISTORY_MAX_LIMIT, HISTORY_MAX_SECONDS } from './history.service';

const logger = getLogger('history-http');

export async function getRoomHistoryMessages(res: HttpResponse, req: HttpRequest) {
  const nspRoomId = req.getParameter(0);
  const nextPageToken = req.getQuery('nextPageToken') || null;
  const seconds = Number(req.getQuery('seconds')) || HISTORY_MAX_SECONDS;
  const limit = Number(req.getQuery('limit')) || HISTORY_MAX_LIMIT;
  const items = Number(req.getQuery('items'));

  let aborted = false;

  if (seconds > HISTORY_MAX_SECONDS) {
    getJsonResponse(res, '400 Bad Request').end(
      JSON.stringify({ status: 400, message: 'Invalid seconds parameter' })
    );
    return;
  }

  if (limit > HISTORY_MAX_LIMIT) {
    getJsonResponse(res, '400 Bad Request').end(
      JSON.stringify({ status: 400, message: 'Invalid limit parameter' })
    );
    return;
  }

  try {
    res.onAborted(() => {
      aborted = true;
    });

    const redisClient = getRedisClient();

    const data = await historyService.getRoomHistoryMessages(
      redisClient,
      nspRoomId,
      seconds || 24 * 60 * 60,
      limit,
      items,
      nextPageToken
    );

    if (!aborted) {
      res.cork(() => {
        getJsonResponse(res, '200 ok').end(JSON.stringify({ status: 200, data }));
      });
    }
  } catch (err: any) {
    logger.error(`Failed to get room history messages`, { err });

    if (!aborted) {
      res.cork(() => {
        getJsonResponse(res, '500 Internal Server Error').end(
          JSON.stringify({ status: 500, message: err.message })
        );
      });
    }
  }
}
