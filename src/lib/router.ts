import { ackHandler } from '@/modules/websocket/websocket.service';
import { ClientEvent } from '@/types/event.types';
import { Session } from '@/types/session.types';
import { getLogger } from '@/util/logger';
import { WebSocket } from 'uWebSockets.js';

const logger = getLogger('router');

const decoder = new TextDecoder('utf-8');

export function createRouter(handlersMap: Record<string, Function>) {
  logger.info(`Creating router`, { handlersMap });

  return function (socket: WebSocket<Session>, message: ArrayBuffer, isBinary: boolean) {
    try {
      const { type, body, ackId, createdAt } = JSON.parse(decoder.decode(message));
      const byteLength = message.byteLength;

      logger.debug(`Handling socket message`, { type, ackId });

      const handler = handlersMap[type as ClientEvent];

      if (!handler) {
        logger.error(`Event ${type} not recognized`, { type, ackId });
        return;
      }

      const res = ackHandler(socket, ackId);

      return handler(socket, body, res, createdAt, byteLength);
    } catch (err: any) {
      logger.error(`Failed to handle socket message`, { err });
    }
  };
}
