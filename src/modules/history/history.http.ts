import { getRedisClient } from '../../lib/redis';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import * as historyService from './history.service';

export async function getRoomHistoryMessages(res: HttpResponse, req: HttpRequest) {
  const nspRoomId = req.getParameter(0);
  const nextPageToken = req.getQuery('nextPageToken') || null;
  const seconds = Number(req.getQuery('seconds')) || 24 * 60 * 60;
  const limit = Number(req.getQuery('limit')) || 100;

  let aborted = false;

  try {
    res.onAborted(() => {
      aborted = true;
      res.writeStatus('500 Internal Server Error');
      res.end(JSON.stringify({ message: 'Request aborted' }));
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
        res.writeHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      });
    }
  } catch (err: any) {
    res.cork(() => {
      res.writeStatus('500 Internal Server Error');
      res.writeHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ message: err.message }));
    });
  }
}
