import { SocketAckHandler } from '@/types/socket.types';
import { WebSocket } from 'uWebSockets.js';
import { Logger } from 'winston';
import { rateLimitGuard } from './websocket.service';
import { formatErrorResponse } from '@/util/format';
import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';

const RATE_LIMIT_EVALUATION_PERIOD_MS = Number(process.env.RATE_LIMIT_EVALUATION_PERIOD_MS) || 5000;
const RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD =
  Number(process.env.RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD) || 30;

export function rateLimitMiddleware(handler: SocketAckHandler): SocketAckHandler {
  return async (
    socket: WebSocket<Session>,
    body: any,
    res: SocketAckHandler,
    createdAt: string
  ): Promise<void> => {
    const session = socket.getUserData();

    try {
      const requestAllowed = await rateLimitGuard(
        redisClient,
        session.connectionId,
        RATE_LIMIT_EVALUATION_PERIOD_MS,
        RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD
      );

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
