import { getRedisClient } from '../../lib/redis';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import * as historyService from './history.service';
import { getLogger } from '../../util/logger';

const logger = getLogger('history-http');

const HISTORY_MAX_RANGE_MS = 60 * 60 * 1000;
const HISTORY_MAX_LIMIT = 100;

export async function getRoomHistoryMessages(res: HttpResponse, req: HttpRequest) {
  const nspRoomId = req.getParameter(0);
  const nextPageToken = req.getQuery('nextPageToken') || null;
  const seconds = Number(req.getQuery('seconds')) || HISTORY_MAX_RANGE_MS;
  const limit = Number(req.getQuery('limit')) || HISTORY_MAX_LIMIT;

  let aborted = false;

  if (seconds > HISTORY_MAX_RANGE_MS) {
    res.writeStatus('400 Bad Request');
    res.writeHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 400, message: 'Invalid seconds parameter' }));
    return;
  }

  if (limit > HISTORY_MAX_LIMIT) {
    res.writeStatus('400 Bad Request');
    res.writeHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 400, message: 'Invalid limit parameter' }));
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
      nextPageToken
    );

    if (!aborted) {
      res.cork(() => {
        res.writeStatus('200 ok');
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 200, data }));
      });
    }
  } catch (err: any) {
    logger.error(`Failed to get room history messages`, { err });

    if (!aborted) {
      res.cork(() => {
        res.writeStatus('500 Internal Server Error');
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 500, message: err.message }));
      });
    }
  }
}
