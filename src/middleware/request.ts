import { SocketAckHandler } from '@/types/socket.types';
import { WebSocket } from 'uWebSockets.js';
import { rateLimitGuard } from '@/modules/websocket/websocket.service';
import { Session } from '@/types/session.types';
import Services from '@/lib/services';
import { getLogger } from '@/util/logger';

const logger = getLogger('rate-limiter');

const RATE_LIMIT_EVALUATION_PERIOD_MS = Number(process.env.RATE_LIMIT_EVALUATION_PERIOD_MS) || 5000;
const RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD =
  Number(process.env.RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD) || 30;

export function rateLimitMiddleware({ redisClient }: Services): SocketAckHandler {
  console.log('SETUP');
  return async (socket: WebSocket<Session>): Promise<void> => {
    logger.debug('Rate limiting request');

    try {
      const session = socket.getUserData();

      const requestAllowed = await rateLimitGuard(
        redisClient,
        session.connectionId,
        RATE_LIMIT_EVALUATION_PERIOD_MS,
        RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD
      );

      if (!requestAllowed) {
        throw new Error('Rate limit exceeded');
      }
    } catch (err: unknown) {
      logger.error(`Failed to rate limit request`, { err });
      throw err;
    }
  };
}
