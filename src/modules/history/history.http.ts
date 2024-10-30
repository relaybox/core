import { getRedisClient } from '@/lib/redis';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import * as historyService from './history.service';
import { getLogger } from '@/util/logger';
import { getErrorResponse, getJsonResponse, getSuccessResponse } from '@/util/http';
import { getMessagesByRoomId, HISTORY_MAX_LIMIT, HISTORY_MAX_SECONDS } from './history.service';
import { HistoryOrder } from '@/types/history.types';
import { Pool, PoolClient } from 'pg';
import { QueryOrder } from '@/util/pg-query';
import { BadRequestError } from '@/lib/errors';
import { HttpMiddleware, ParsedHttpRequest } from '@/util/middleware';

const logger = getLogger('history-http');

export async function getRoomHistoryMessages(res: HttpResponse, req: HttpRequest) {
  let aborted = false;

  res.onAborted(() => {
    aborted = true;
  });

  res.cork(() => {
    getJsonResponse(res, '501 Not Implemented').end(
      JSON.stringify({ status: 501, message: 'HTTPS history endpoint not implemented' })
    );
  });

  return;
}

export async function _getRoomHistoryMessages(res: HttpResponse, req: HttpRequest) {
  const nspRoomId = req.getParameter(0);
  const nextPageToken = req.getQuery('nextPageToken') || null;
  const seconds = Number(req.getQuery('seconds')) || null;
  const limit = Number(req.getQuery('limit')) || HISTORY_MAX_LIMIT;
  const items = Number(req.getQuery('items')) || null;
  const order = (req.getQuery('order') as HistoryOrder) || HistoryOrder.DESC;
  const start = Number(req.getQuery('start')) || null;
  const end = Number(req.getQuery('end')) || null;

  let aborted = false;

  if (seconds && seconds > HISTORY_MAX_SECONDS) {
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

  if (order !== HistoryOrder.DESC && !seconds && !start) {
    getJsonResponse(res, '400 Bad Request').end(
      JSON.stringify({
        status: 400,
        message: `Either 'seconds' or 'start' must be provided when order is ${HistoryOrder.ASC}`
      })
    );

    return;
  }

  // HANLDE START TIME GREATER THAN 24 HOURS BEFORE END TIME

  try {
    res.onAborted(() => {
      aborted = true;
    });

    const redisClient = getRedisClient();

    const data = await historyService.getRoomHistoryMessages(
      redisClient,
      nspRoomId,
      start,
      end,
      seconds || 24 * 60 * 60,
      limit,
      items,
      order,
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

      if (limit > HISTORY_MAX_LIMIT) {
        throw new BadRequestError('Invalid limit parameter');
      }

      if (offset < 0) {
        throw new BadRequestError('Invalid offset parameter');
      }

      const result = await getMessagesByRoomId(
        logger,
        pgClient,
        roomId,
        offset,
        limit,
        order,
        start,
        end
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
