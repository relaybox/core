import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse } from '@/util/format';
import { EventHandler } from '@/lib/handlers';
import { getLogger } from '@/util/logger';

const logger = getLogger('pipe');

const DEFAULT_MIDDLEWARE_TIMEOUT_MS = 5000;

export function pipe(...middlewares: EventHandler[]): EventHandler {
  return async (
    socket: WebSocket<Session>,
    body: any,
    res: SocketAckHandler,
    createdAt?: string,
    byteLength?: number
  ): Promise<void> => {
    for (const middleware of middlewares) {
      const { requestTimeout, clearRequestTimeout } = getMiddlewareTimeout();

      try {
        await Promise.race([requestTimeout, middleware(socket, body, res, createdAt, byteLength)]);
      } catch (err: any) {
        logger.error(`Failed to handle socket message`, { err });

        if (res) {
          res(null, formatErrorResponse(err));
        }

        return;
      } finally {
        clearRequestTimeout();
      }
    }
  };
}

function getMiddlewareTimeout(duration = DEFAULT_MIDDLEWARE_TIMEOUT_MS) {
  let timeoutId: NodeJS.Timeout;

  const requestTimeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Timeout occurred'));
    }, duration);
  });

  return {
    requestTimeout,
    clearRequestTimeout: () => clearTimeout(timeoutId)
  };
}
