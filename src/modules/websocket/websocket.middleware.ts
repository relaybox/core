import { SocketAckHandler } from '@/types/socket.types';
import { WebSocket } from 'uWebSockets.js';
import { Logger } from 'winston';
import { rateLimitGuard } from './websocket.service';
import { formatErrorResponse } from '@/util/format';
import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';

export function rateLimitMiddleware(handler: SocketAckHandler): SocketAckHandler {
  return async (
    logger: Logger,
    redisClient: RedisClient,
    socket: WebSocket<Session>,
    body: any,
    res: SocketAckHandler,
    createdAt: string
  ): Promise<void> => {
    const session = socket.getUserData();

    try {
      const requestAllowed = await rateLimitGuard(redisClient, session.connectionId);

      if (!requestAllowed) {
        throw new Error('Rate limit exceeded');
      }

      return handler(logger, redisClient, socket, body, res, createdAt);
    } catch (err: any) {
      logger.error(`Failed to handle rate limited socket message`, { err, session });
      res(null, formatErrorResponse(err));
    }
  };
}
