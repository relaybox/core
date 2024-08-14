import { getRedisClient } from '../../lib/redis';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import * as historyService from './history.service';

export async function getChannelHistoryMessages(res: HttpResponse, req: HttpRequest) {
  const redisClient = getRedisClient();
  const nspRoomId = req.getParameter(0);
  const nextPageToken = req.getQuery('nextPageToken') || null;
  const seconds = Number(req.getQuery('seconds'));

  let aborted = false;

  res.onAborted(() => {
    aborted = true;
    res.end(JSON.stringify({ message: 'Request aborted' }));
  });

  try {
    const data = await historyService.getChannelHistoryMessages(
      redisClient,
      nspRoomId,
      seconds || 24 * 60 * 60,
      100,
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
