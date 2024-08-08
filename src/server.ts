import 'dotenv/config';

import { App, HttpResponse, HttpRequest, WebSocket } from 'uWebSockets.js';
import { getLogger } from './util/logger';
import {
  handleClientHeartbeat,
  handleConnectionUpgrade,
  handleDisconnect,
  handleSocketMessage,
  handleSocketOpen,
  handleSubscription
} from './modules/websocket/websocket.service';
import { Session } from './types/session.types';
import { enqueueDeliveryMetrics } from './modules/metrics/metrics.service';
import AmqpManager from './lib/amqp-manager';
import os from 'os';

// Force deploy 1.5

const logger = getLogger('uws-socket-server');

const SERVER_PORT = process.env.SERVER_PORT || 4004;
const CONTAINER_HOSTNAME = process.env.SERVER_PORT || os.hostname();
const WS_IDLE_TIMEOUT_MS = Number(process.env.WS_IDLE_TIMEOUT_MS) / 1000;
const LISTEN_EXCLUSIVE_PORT = 1;

const app = App()
  .get('/', (res: HttpResponse, req: HttpRequest) => {
    res.end(process.uptime().toString());
  })
  .ws('/*', {
    idleTimeout: WS_IDLE_TIMEOUT_MS,
    sendPingsAutomatically: true,
    subscription: handleSubscription,
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

const amqpManager = AmqpManager.getInstance(app, {
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
