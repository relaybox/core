import 'dotenv/config';

import os from 'os';
import { App, HttpResponse, WebSocket } from 'uWebSockets.js';
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
import AmqpManager from '@/lib/amqp-manager/amqp-manager';
import { getHistoryMessages } from '@/modules/history/history.http';
import { getCorsResponse } from '@/util/http';
import { eventEmitter } from '@/lib/event-bus';
import { cleanupRedisClient, getRedisClient } from '@/lib/redis';
import { cleanupPgPool, getPgPool } from '@/lib/pg';
import { handleClientEvent } from './modules/events/events.handlers';
import { cleanupAmqpPublisher, getPublisher } from '@/lib/publisher';
import { compose } from '@/lib/middleware';
import { verifyAuthToken } from './modules/auth/auth.middleware';

const SERVER_PORT = process.env.SERVER_PORT || 4004;
const CONTAINER_HOSTNAME = process.env.SERVER_PORT || os.hostname();
const WS_IDLE_TIMEOUT_SECS = Number(process.env.WS_IDLE_TIMEOUT_MS) / 1000;
const LISTEN_EXCLUSIVE_PORT = 1;
const WS_MAX_LIFETIME_MINS = 60;

const logger = getLogger('core-socket-server');
const pgPool = getPgPool();
const redisClient = getRedisClient();
const publisher = getPublisher();

const app = App();

app.options('/*', (res: HttpResponse) => {
  const corsReponse = getCorsResponse(res);
  corsReponse.end();
});

app.get('/', (res: HttpResponse) => {
  res.end(process.uptime().toString());
});

app.post('/events', compose(handleClientEvent(pgPool!)));

app.get(
  '/history/:roomId/messages',
  compose(verifyAuthToken(logger, pgPool), getHistoryMessages(pgPool!))
);

app.ws('/*', {
  maxLifetime: WS_MAX_LIFETIME_MINS,
  idleTimeout: WS_IDLE_TIMEOUT_SECS,
  sendPingsAutomatically: true,
  subscription: handleSubscriptionBindings,
  upgrade: handleConnectionUpgrade,
  open: (socket: WebSocket<Session>) => handleSocketOpen(socket, redisClient),
  pong: handleClientHeartbeat,
  message: (socket: WebSocket<Session>, message: ArrayBuffer, isBinary: boolean) => {
    handleSocketMessage(socket, redisClient, message, isBinary, app);
  },
  close: (socket: WebSocket<Session>, code: number, message: ArrayBuffer) => {
    handleDisconnect(socket, redisClient, code, message, CONTAINER_HOSTNAME);
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

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, 20000);

  try {
    await Promise.all([cleanupRedisClient(), cleanupPgPool(), cleanupAmqpPublisher()]);

    clearTimeout(shutdownTimeout);

    logger.info('Shutdown complete');

    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { err });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
