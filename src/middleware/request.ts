import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import Services from '@/lib/services';
import { rateLimitGuard } from '@/modules/guards/guards.service';
import { EventHandler } from '@/lib/handlers';

const RATE_LIMIT_EVALUATION_PERIOD_MS = Number(process.env.RATE_LIMIT_EVALUATION_PERIOD_MS) || 5000;
const RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD =
  Number(process.env.RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD) || 30;

export function rateLimitMiddleware({ redisClient }: Services): EventHandler {
  return async (socket: WebSocket<Session>): Promise<void> => {
    const session = socket.getUserData();

    await rateLimitGuard(
      redisClient,
      session.connectionId,
      RATE_LIMIT_EVALUATION_PERIOD_MS,
      RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD
    );
  };
}
