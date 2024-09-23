import 'dotenv/config';

import os from 'os';
import { App, HttpResponse, HttpRequest, WebSocket } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import {
  handleClientHeartbeat,
  handleConnectionUpgrade,
  handleDisconnect,
  handleSocketMessage,
  handleSocketOpen,
  handleSubscriptionBindings
} from '@/modules/websocket/websocket.service';
import { Session } from '@/types/session.types';
import { enqueueDeliveryMetrics } from '@/modules/metrics/metrics.service';
import AmqpManager from '@/lib/amqp-manager';
import { getRoomHistoryMessages } from '@/modules/history/history.http';
import { getCorsResponse } from '@/util/http';
import { eventEmitter } from '@/lib/event-bus';

const logger = getLogger('uws-socket-server');

const SERVER_PORT = process.env.SERVER_PORT || 4004;
const CONTAINER_HOSTNAME = process.env.SERVER_PORT || os.hostname();
const WS_IDLE_TIMEOUT_MS = Number(process.env.WS_IDLE_TIMEOUT_MS) / 1000;
const LISTEN_EXCLUSIVE_PORT = 1;
const WS_MAX_LIFETIME_MINS = 60;

const app = App()
  .options('/*', (res: HttpResponse, req: HttpRequest) => {
    const corsReponse = getCorsResponse(res);
    corsReponse.end();
  })
  .get('/', (res: HttpResponse, req: HttpRequest) => {
    res.end(process.uptime().toString());
  })
  .get('/rooms/:nspRoomId/messages', getRoomHistoryMessages)
  .ws('/*', {
    maxLifetime: WS_MAX_LIFETIME_MINS,
    idleTimeout: WS_IDLE_TIMEOUT_MS,
    sendPingsAutomatically: true,
    subscription: handleSubscriptionBindings,
    upgrade: handleConnectionUpgrade,
    open: handleSocketOpen,
    pong: handleClientHeartbeat,
    message: (socket: WebSocket<Session>, message: ArrayBuffer, isBinary: boolean) => {
      handleSocketMessage(socket, message, isBinary, app);
    },
    close: (socket: WebSocket<Session>, code: number, message: ArrayBuffer) => {
      handleDisconnect(socket, code, message, CONTAINER_HOSTNAME);
    }
  });

const amqpManager = AmqpManager.getInstance(app, eventEmitter, {
  instanceId: CONTAINER_HOSTNAME,
  enqueueDeliveryMetrics
});

amqpManager.connect().then((_) => {
  const port = Number(SERVER_PORT);

  app.listen(port, LISTEN_EXCLUSIVE_PORT, (socket) => {
    if (socket) {
      logger.info(`Server listening on port ${CONTAINER_HOSTNAME}:${port}`);
    } else {
      logger.error(`Failed to listen on port ${CONTAINER_HOSTNAME}:${port}`);
    }
  });
});
