import { PresenceJobName, defaultJobConfig, presenceQueue } from './presence.queue';
import { getReducedSession } from '../session/session.service';
import { Session } from '../../types/session.types';
import { Job } from 'bullmq';
import { RedisClient } from '../../lib/redis';
import { getActiveMemberCountByRoomId, getActiveMembersByRoomId } from './presence.repository';
import { LatencyLog } from 'src/types/request.types';

export function addActiveMember(
  clientId: string,
  nspRoomId: string,
  subscription: string,
  session: Session,
  message: any,
  latencyLog?: LatencyLog
): Promise<Job> {
  const reducedSession = getReducedSession(session);

  return presenceQueue.add(
    PresenceJobName.PRESENCE_JOIN,
    {
      clientId,
      nspRoomId,
      subscription,
      session: reducedSession,
      message,
      latencyLog
    },
    { ...defaultJobConfig }
  );
}

export function removeActiveMember(
  clientId: string,
  nspRoomId: string,
  subscription: string,
  session: Session,
  message?: any,
  latencyLog?: LatencyLog
): Promise<Job> {
  const reducedSession = getReducedSession(session);

  return presenceQueue.add(
    PresenceJobName.PRESENCE_LEAVE,
    {
      clientId,
      nspRoomId,
      subscription,
      session: reducedSession,
      ...(message && { message }),
      latencyLog
    },
    { ...defaultJobConfig }
  );
}

export function updateActiveMember(
  clientId: string,
  nspRoomId: string,
  subscription: string,
  session: Session,
  message: any,
  latencyLog?: LatencyLog
): Promise<Job> {
  const reducedSession = getReducedSession(session);

  return presenceQueue.add(
    PresenceJobName.PRESENCE_UPDATE,
    {
      clientId,
      nspRoomId,
      subscription,
      session: reducedSession,
      message,
      latencyLog
    },
    { ...defaultJobConfig }
  );
}

export function getActiveMembers(redisClient: RedisClient, nspRoomId: string): Promise<any[]> {
  return getActiveMembersByRoomId(redisClient, nspRoomId);
}

export function getActiveMemberCount(redisClient: RedisClient, nspRoomId: string): Promise<number> {
  return getActiveMemberCountByRoomId(redisClient, nspRoomId);
}
