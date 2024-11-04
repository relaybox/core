import { WebSocket } from 'uWebSockets.js';
import { Session } from '@/types/session.types';
import { SocketAckHandler } from '@/types/socket.types';
import { formatErrorResponse } from '@/util/format';

const DEFAULT_MIDDLEWARE_TIMEOUT_MS = 5000;

export function pipe(...middlewares: Function[]) {
  return async (socket: WebSocket<Session>, body: any, res: SocketAckHandler): Promise<void> => {
    async function dispatch(i: number) {
      const nextMiddleware = middlewares[i];

      if (!nextMiddleware) {
        return;
      }

      const { requestTimeout, clearRequestTimeout } = getMiddlewareTimeout(
        DEFAULT_MIDDLEWARE_TIMEOUT_MS
      );

      try {
        await Promise.race([requestTimeout, nextMiddleware(socket, body, res)]);
        clearRequestTimeout();

        if (middlewares[i + 1]) {
          await dispatch(i + 1);
        }

        return;
      } catch (err: any) {
        if (res) {
          res(null, formatErrorResponse(err));
        }
      }
    }

    dispatch(0);
  };
}

function getMiddlewareTimeout(duration = 500) {
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
