import { PresenceJobName, defaultJobConfig, presenceQueue } from './presence.queue';
import { getReducedSession } from '@/modules/session/session.service';
import { Session } from '@/types/session.types';
import { Job } from 'bullmq';
import { RedisClient } from '@/lib/redis';
import * as repository from './presence.repository';
import { LatencyLog } from '@/types/request.types';

export function addActiveMember(
  clientId: string,
  nspRoomId: string,
  subscription: string,
  session: Session,
  message: any,
  latencyLog?: LatencyLog
): Promise<Job> {
  const reducedSession = getReducedSession(session);

  const jobData = {
    clientId,
    nspRoomId,
    subscription,
    session: reducedSession,
    message,
    latencyLog
  };

  console.log('JOIN JOB DATA', jobData);

  return presenceQueue.add(PresenceJobName.PRESENCE_JOIN, jobData, defaultJobConfig);
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

  const jobData = {
    clientId,
    nspRoomId,
    subscription,
    session: reducedSession,
    ...(message && { message }),
    latencyLog
  };

  console.log('LEAVE JOB DATA', jobData, message);

  return presenceQueue.add(PresenceJobName.PRESENCE_LEAVE, jobData, defaultJobConfig);
}

export function updateActiveMember(
  clientId: string,
  nspRoomId: string,
  subscription: string,
  session: Session,
  message: any,
  latencyLog?: LatencyLog
) {
  const reducedSession = getReducedSession(session);

  const jobData = {
    clientId,
    nspRoomId,
    subscription,
    session: reducedSession,
    message,
    latencyLog
  };

  return presenceQueue.add(PresenceJobName.PRESENCE_UPDATE, jobData, defaultJobConfig);
}

export function getActiveMembers(redisClient: RedisClient, nspRoomId: string): Promise<any[]> {
  return repository.getActiveMembersByRoomId(redisClient, nspRoomId);
}

export function getActiveMemberCount(redisClient: RedisClient, nspRoomId: string): Promise<number> {
  return repository.getActiveMemberCountByRoomId(redisClient, nspRoomId);
}

export async function isActiveMember(
  redisClient: RedisClient,
  uid: string,
  nspRoomId: string
): Promise<boolean> {
  const activeMember = await repository.isActiveMember(redisClient, uid, nspRoomId);

  return !!activeMember;
}
