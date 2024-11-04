import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import Services from '@/lib/services';
import { rateLimitGuard } from '@/modules/guards/guards.service';
import { EventHandler } from '@/lib/handlers';
import { SocketAckHandler } from '@/types/socket.types';

const RATE_LIMIT_EVALUATION_PERIOD_MS = Number(process.env.RATE_LIMIT_EVALUATION_PERIOD_MS) || 5000;
const RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD =
  Number(process.env.RATE_LIMIT_MAX_MESSAGES_PER_EVALUATION_PERIOD) || 30;
const MESSAGE_MAX_BYTE_LENGTH = 64 * 1024;

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

export function sizeLimitMiddleware(
  socket: WebSocket<Session>,
  body: any,
  res: SocketAckHandler,
  createdAt?: string,
  byteLength?: number
): void {
  if (byteLength && byteLength > MESSAGE_MAX_BYTE_LENGTH) {
    throw new Error('Message is too large');
  }
}
