import { HttpResponse } from 'uWebSockets.js';
import { getErrorResponse, getSuccessResponse } from '@/util/http';
import { getLogger } from '@/util/logger';
import { v4 as uuid } from 'uuid';
import { RedisClient } from '@/lib/redis';
import { Pool } from 'pg';
import AmqpManager from '@/lib/amqp-manager/amqp-manager';
import { getLatencyLog } from './events.service';
import { DsPermission } from '@/types/permissions.types';
import { permissionsGuard } from '@/modules/guards/guards.service';
import { getNspEvent, getNspRoomId } from '@/util/helpers';
import { addRoomHistoryMessage } from '../history/history.service';
import { enqueueMessage } from '@/lib/publisher';
import { HttpMiddleware, ParsedHttpRequest } from '@/lib/middleware';
import { BadRequestError } from '@/lib/errors';
import {
  getSecretKey,
  getUserByClientId,
  verifySignature,
  verifyTimestamp
} from '@/modules/auth/auth.service';
import { getPermissions } from '@/modules/permissions/permissions.service';

const logger = getLogger('event');

const MAX_TIMESTAMP_DIFF_SECS = 30;

export function handleClientEvent(pgPool: Pool, redisClient: RedisClient): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest) => {
    const requestId = uuid();

    logger.info('Publishing event', { requestId });

    const pgClient = await pgPool.connect();

    try {
      const publicKey = req.headers['x-ds-public-key'];
      const signature = req.headers['x-ds-req-signature'];

      if (!publicKey || !signature) {
        throw new BadRequestError('Public key and signature headers are required');
      }

      const body = req.body;

      const [appPid, keyId] = publicKey.split('.');
      const secretKey = await getSecretKey(logger, pgClient, appPid, keyId);

      await verifySignature(body, signature, secretKey);

      const { event, roomId, data, timestamp, clientId } = JSON.parse(body);
      const verifiedTimestamp = verifyTimestamp(timestamp, MAX_TIMESTAMP_DIFF_SECS);
      const permissions = await getPermissions(logger, pgClient, keyId);

      permissionsGuard(roomId, DsPermission.PUBLISH, permissions);

      const user = clientId ? await getUserByClientId(logger, pgClient, clientId) : null;

      const latencyLog = getLatencyLog(timestamp);
      const nspRoomId = getNspRoomId(appPid, roomId);
      const nspEvent = getNspEvent(nspRoomId, event);

      const sender = {
        clientId,
        connectionId: null,
        user
      };

      const session = {
        appPid,
        keyId,
        uid: clientId || null,
        clientId,
        connectionId: null,
        socketId: null
      };

      const extendedMessageData = {
        id: requestId,
        body: data,
        sender,
        timestamp: new Date().getTime(),
        event
      };

      const amqpManager = AmqpManager.getInstance();

      const processedMessageData = amqpManager.dispatchHandler
        .to(nspRoomId)
        .dispatch(nspEvent, extendedMessageData, session, latencyLog);

      const persistedMessageData = {
        roomId,
        event,
        message: processedMessageData
      };

      await addRoomHistoryMessage(redisClient, nspRoomId, extendedMessageData);
      await enqueueMessage(persistedMessageData);

      res.cork(() =>
        getSuccessResponse(res, {
          requestId,
          timestamp: verifiedTimestamp
        })
      );

      return;
    } catch (err: any) {
      logger.error(`Failed to publish event`, { err });

      res.cork(() => getErrorResponse(res, err));

      return;
    } finally {
      if (pgClient) {
        pgClient.release();
      }
    }
  };
}
