import 'dotenv/config';

import os from 'os';
import { App, HttpResponse, WebSocket } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import {
  handleClientHeartbeat,
  handleConnectionUpgrade,
  handleDisconnect,
  handleSocketOpen,
  handleSubscriptionBindings
} from '@/modules/websocket/websocket.service';
import { Session } from '@/types/session.types';
import { getHistoryMessages } from '@/modules/history/history.http';
import { getCorsResponse } from '@/util/http';
import { compose } from '@/lib/middleware';
import { verifyAuthToken } from './modules/auth/auth.middleware';
import { createEventHandlersMap } from './lib/handlers';
import { createRouter } from './lib/router';
import Services from './lib/services';
import { handler as handleClientEvent } from '@/handlers/events/post';

const SERVER_PORT = process.env.SERVER_PORT || 4004;
const CONTAINER_HOSTNAME = process.env.SERVER_PORT || os.hostname();
const WS_IDLE_TIMEOUT_SECS = Number(process.env.WS_IDLE_TIMEOUT_MS) / 1000;
const LISTEN_EXCLUSIVE_PORT = 1;
const WS_MAX_LIFETIME_MINS = 60;

const logger = getLogger('core-socket-server');

const app = App();
const services = new Services(logger, app, CONTAINER_HOSTNAME);
const eventHandlersMap = createEventHandlersMap(services);
const eventRouter = createRouter(eventHandlersMap);

app.options('/*', (res: HttpResponse) => {
  const corsReponse = getCorsResponse(res);
  corsReponse.end();
});

app.get('/', (res: HttpResponse) => {
  res.end(process.uptime().toString());
});

app.post('/events', compose(handleClientEvent(services)));

app.get(
  '/history/:roomId/messages',
  compose(verifyAuthToken(logger, services), getHistoryMessages(services))
);

app.ws('/*', {
  maxLifetime: WS_MAX_LIFETIME_MINS,
  idleTimeout: WS_IDLE_TIMEOUT_SECS,
  sendPingsAutomatically: true,
  subscription: handleSubscriptionBindings,
  upgrade: handleConnectionUpgrade,
  open: (socket: WebSocket<Session>) => handleSocketOpen(socket, services.redisClient),
  pong: handleClientHeartbeat,
  message: eventRouter,
  close: (socket: WebSocket<Session>, code: number, message: ArrayBuffer) => {
    handleDisconnect(socket, services.redisClient, code, message, CONTAINER_HOSTNAME);
  }
});

services.connect().then((_) => {
  const port = Number(SERVER_PORT);

  app.listen(port, LISTEN_EXCLUSIVE_PORT, (socket) => {
    if (socket) {
      logger.info(`Server listening on port ${CONTAINER_HOSTNAME}:${port}`);
    } else {
      logger.error(`Failed to listen on port ${CONTAINER_HOSTNAME}:${port}`);
    }
  });
});

process.on('SIGTERM', () => services.disconnect('SIGTERM'));
process.on('SIGINT', () => services.disconnect('SIGINT'));
