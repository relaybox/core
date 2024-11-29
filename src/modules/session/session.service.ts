import { ReducedSession, Session } from '@/types/session.types';
import { pushRoomLeaveMetrics } from '@/modules/metrics/metrics.service';
import { verifyApiKey, verifyAuthToken } from '@/modules/auth/auth.service';
import { SessionJobName, defaultJobConfig, sessionQueue } from './session.queue';
import { Job } from 'bullmq';
import { RedisClient } from '@/lib/redis';
import { restoreCachedRooms } from '@/modules/room/room.service';
import { getCachedRooms } from '@/modules/room/room.service';
import { SocketConnectionEventType } from '@/types/socket.types';
import { WebSocket } from 'uWebSockets.js';
import { restoreCachedUsers } from '@/modules/user/user.service';
import { enqueueWebhookEvent } from '../webhook/webhook.service';
import { WebhookEvent } from '@/types/webhook.types';
import { getSoftSessionDeleteJobId } from '@/util/helpers';
import { ConnectionAuth } from '@/types/auth.types';
import { Logger } from 'winston';

/**
 * Grace period for soft session delete
 */
const SESSION_INACTIVE_JOB_DELAY_MS = 5000;

/**
 * Set to 4x the idle timeout value to ensure session destroy works
 * in conjunction with socket heartbeat
 * Essentially, theis means that if a socket misses 4 heartbeats
 * the session will be destroyed
 */
const SESSION_DESTROY_JOB_DELAY_MS = Number(process.env.WS_IDLE_TIMEOUT_MS) * 4;

export async function initializeSession(
  logger: Logger,
  connectionAuthParams: ConnectionAuth
): Promise<Session> {
  try {
    const { token, apiKey, clientId, connectionId } = connectionAuthParams;

    const verifiedSession = apiKey
      ? await verifyApiKey(logger, apiKey, clientId, connectionId)
      : await verifyAuthToken(logger, token!, connectionId);

    logger.info(`Initializing verified session ${connectionId}`, { clientId, connectionId });

    await enqueueWebhookEvent(logger, WebhookEvent.AUTH_SESSION_INITIALIZE, null, verifiedSession);

    return verifiedSession;
  } catch (err: any) {
    logger.error(`Session initialization failed`, { err });
    throw err;
  }
}

export async function restoreSession(
  logger: Logger,
  redisClient: RedisClient,
  session: Session,
  socket: WebSocket<Session>
): Promise<void> {
  try {
    await Promise.all([
      restoreCachedRooms(logger, redisClient, session, socket),
      restoreCachedUsers(logger, redisClient, session, socket)
    ]);
  } catch (err) {
    logger.error(`Session restoration failed`, { err });
    throw err;
  }
}

export async function clearSessionMetrics(
  logger: Logger,
  redisClient: RedisClient,
  session: Session
): Promise<void> {
  const { uid, connectionId } = session;

  try {
    const rooms = await getCachedRooms(logger, redisClient, connectionId);

    if (rooms && rooms.length > 0) {
      await Promise.all(
        rooms.map(async (nspRoomId) => pushRoomLeaveMetrics(uid, nspRoomId, session))
      );
    }
  } catch (err) {
    logger.error(`Failed to clear session metrics`, { err, uid, connectionId });
    throw err;
  }
}

/**
 * Hard session delete
 *
 * Delayed job to destroy a session, including subscriptions, metrics etc.
 * Updates persistent data store with session status.
 * Reconnection using the same connectionId within SESSION_DESTROY_JOB_DELAY_MS will
 * remove the job, effectively cancelling the hard session delete
 */
export async function markSessionForDeletion(
  logger: Logger,
  session: Session,
  instanceId: string | number
): Promise<Job> {
  logger.debug('Marking session for deletion', { session });

  const { connectionId } = session;

  const exsitingJob = await sessionQueue.getJob(connectionId);

  if (exsitingJob) {
    logger.debug(`Existing session destroy job found, removing...`, { connectionId });
    await exsitingJob.remove();
  }

  const reducedSession = getReducedSession(session);

  const jobData = {
    ...reducedSession,
    instanceId
  };

  const jobConfig = {
    jobId: connectionId,
    delay: SESSION_DESTROY_JOB_DELAY_MS,
    ...defaultJobConfig
  };

  return sessionQueue.add(SessionJobName.SESSION_DESTROY, jobData, jobConfig);
}

/**
 * Soft session delete
 *
 * Delayed job to set the user as inactive.
 * Primarily used to update presence sets related to user by connectionId.
 * Removes active member from presence sets and broadcasts the leave event.
 * Reconnection within SESSION_INACTIVE_JOB_DELAY_MS from
 * the same connectionId will remove the job and ensure active presence is not affected
 */
export async function markSessionUserInactive(
  logger: Logger,
  session: Session,
  instanceId: string | number
): Promise<Job> {
  logger.debug('Marking session user as inactive', { session });

  const reducedSession = getReducedSession(session);

  const jobData = {
    ...reducedSession,
    instanceId
  };

  const jobId = getSoftSessionDeleteJobId(session.connectionId);

  const jobConfig = {
    jobId,
    delay: SESSION_INACTIVE_JOB_DELAY_MS,
    ...defaultJobConfig
  };

  return sessionQueue.add(SessionJobName.SESSION_USER_INACTIVE, jobData, jobConfig);
}

/**
 * Cancels a hard session delete job
 */
export async function unmarkSessionForDeletion(logger: Logger, connectionId: string): Promise<any> {
  logger.debug('Unmarking session for deletion', { connectionId });

  try {
    await clearDelayedSessionJob(logger, connectionId);
  } catch (err) {
    logger.error(`Failed to delete job with ID ${connectionId}:`, { err });
    throw err;
  }
}

/**
 * Cancels a soft session delete job
 */
export async function markSessionUserActive(logger: Logger, connectionId: string): Promise<any> {
  logger.debug('Setting session user as active', { connectionId });

  try {
    const jobId = getSoftSessionDeleteJobId(connectionId);
    await clearDelayedSessionJob(logger, jobId);
  } catch (err) {
    logger.error(`Failed to delete job with ID _:${connectionId}:`, { err });
    throw err;
  }
}

async function clearDelayedSessionJob(logger: Logger, id: string) {
  logger.debug('Clearing delayed session job', { id });

  try {
    const job = await sessionQueue.getJob(id);

    if (job) {
      await job.remove();
      logger.debug(`Session delete job removed`, { id: job.id, name: job.name });
    }
  } catch (err) {
    logger.error(`Failed to delete job with ID ${id}:`, { err });
    throw err;
  }
}

/**
 * Event recieved from socket ping handler
 * Keeps the session active by updating the active session cache key ttl
 * This is used by core session service cron to cleanup dangling sessions
 * and to keep a log of currently active sessions
 */
export function setSessionActive(
  logger: Logger,
  session: Session,
  socket: WebSocket<Session>
): Promise<Job> {
  logger.debug(`Setting session active, ${session.connectionId}`, { session });

  const { permissions, ...rest } = session;

  const timestamp = new Date().toISOString();

  const jobData = {
    ...rest,
    timestamp,
    socketId: socket.getUserData().socketId
  };

  return sessionQueue.add(SessionJobName.SESSION_ACTIVE, jobData, defaultJobConfig);
}

export function getReducedSession(session: Session, socket?: WebSocket<Session>): ReducedSession {
  const { appPid, keyId, uid, connectionId, clientId, user } = session;

  const socketId = socket?.getUserData()?.socketId || session.socketId;

  const reducedSession: ReducedSession = {
    appPid,
    keyId,
    uid,
    connectionId,
    clientId,
    socketId,
    user
  };

  return reducedSession;
}

/**
 * Messgage processed instantly by core session service
 * to keep a log of all connection state changes
 *
 * @param logger
 * @param session
 * @param socket
 * @param connectionEventType either "connect" or "disconnect"
 */
export function recordConnnectionEvent(
  logger: Logger,
  session: Session,
  socket: WebSocket<Session>,
  connectionEventType: SocketConnectionEventType
): Promise<Job> {
  logger.debug(`Recording socket connection event, ${connectionEventType}`, {
    session,
    connectionEventType
  });

  const reducedSession = getReducedSession(session, socket);
  const connectionEventTimestamp = new Date().toISOString();

  const connectionEvent = {
    connectionEventType,
    connectionEventTimestamp
  };

  const jobData = {
    ...reducedSession,
    ...connectionEvent
  };

  return sessionQueue.add(
    SessionJobName.SESSION_SOCKET_CONNECTION_EVENT,
    jobData,
    defaultJobConfig
  );
}
