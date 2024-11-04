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

      logger.debug(`Handling socket message`, { type, ackId });

      // IMPLEMENT AS MIDDLEWARE!!!!
      // if (message.byteLength > MESSAGE_MAX_BYTE_LENGTH) {
      //   handleByteLengthError(socket, ackId);
      // }

      const handler = handlersMap[type as ClientEvent];

      if (!handler) {
        logger.error(`Event ${type} not recognized`, { type, ackId });
        return;
      }

      const res = ackHandler(socket, ackId);

      return handler(socket, body, res, createdAt);
    } catch (err: any) {
      logger.error(`Failed to handle socket message`, { err });
    }
  };
}
