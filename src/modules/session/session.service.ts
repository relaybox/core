import { getLogger } from '@/util/logger';
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
import { getNspJobId } from '@/util/helpers';

const logger = getLogger('session');

const SESSION_INACTIVE_JOB_DELAY_MS = 5000;

// Set to 4x the idle timeout value to ensure session destroy works
// ...in conjunction with socket heartbeat
const SESSION_DESTROY_JOB_DELAY_MS = Number(process.env.WS_IDLE_TIMEOUT_MS) * 4;

export async function initializeSession(connectionAuthParams: ConnectionAuth): Promise<Session> {
  try {
    const { token, apiKey, clientId, connectionId, uid } = connectionAuthParams;

    const verifiedSession = apiKey
      ? await verifyApiKey(apiKey, clientId, connectionId)
      : await verifyAuthToken(token!, connectionId);

    logger.info(`Initializing verified session ${connectionId}`, { clientId, connectionId });

    await enqueueWebhookEvent(WebhookEvent.AUTH_SESSION_INITIALIZE, null, verifiedSession);

    return verifiedSession;
  } catch (err: any) {
    logger.error(`Session initialization failed`, { err });
    throw err;
  }
}

export async function restoreSession(
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

export async function markSessionForDeletion(
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

export async function markSessionUserInactive(
  session: Session,
  instanceId: string | number
): Promise<Job> {
  logger.debug('Marking session user as inactive', { session });

  const { appPid, uid } = session;

  const reducedSession = getReducedSession(session);

  const jobData = {
    ...reducedSession,
    instanceId
  };

  const jobId = getNspJobId(appPid, uid);

  const jobConfig = {
    jobId,
    delay: SESSION_INACTIVE_JOB_DELAY_MS,
    // attempts: SESSION_DESTROY_JOB_MAX_ATTEMPTS,
    // backoff: {
    //   type: 'exponential',
    //   delay: 1000
    // },
    ...defaultJobConfig
  };

  return sessionQueue.add(SessionJobName.SESSION_USER_INACTIVE, jobData, jobConfig);
}

export async function unmarkSessionForDeletion(connectionId: string): Promise<any> {
  logger.debug('Unmarking session for deletion', { connectionId });

  try {
    await clearDelayedSessionJob(connectionId);
  } catch (err) {
    logger.error(`Failed to delete job with ID ${connectionId}:`, { err });
    throw err;
  }
}

export async function markSessionUserActive(appPid: string, uid: string): Promise<any> {
  logger.debug('Setting session user as active', { appPid, uid });

  try {
    const jobId = getNspJobId(appPid, uid);
    await clearDelayedSessionJob(jobId);
  } catch (err) {
    logger.error(`Failed to delete job with ID ${uid}:`, { err });
    throw err;
  }
}

async function clearDelayedSessionJob(id: string) {
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

export function setSessionActive(session: Session, socket: WebSocket<Session>): Promise<Job> {
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

export function recordConnnectionEvent(
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

export function enqueueSessionHeartbeat(session: Session): Promise<Job> {
  logger.debug('Setting session heartbeat', { session });

  const { permissions, ...rest } = session;

  const timestamp = new Date().toISOString();

  const jobData = {
    ...rest,
    timestamp
  };

  return sessionQueue.add(SessionJobName.SESSION_HEARTBEAT, jobData, defaultJobConfig);
}
