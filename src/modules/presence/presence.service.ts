import { PresenceJobName, defaultJobConfig, presenceQueue } from './presence.queue';
import { getReducedSession } from '@/modules/session/session.service';
import { Session } from '@/types/session.types';
import { Job } from 'bullmq';
import { RedisClient } from '@/lib/redis';
import * as cache from './presence.cache';
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

export async function getActiveMembers(
  redisClient: RedisClient,
  nspRoomId: string
): Promise<any[]> {
  const members = await cache.getActiveMembersByRoomId(redisClient, nspRoomId);

  return Object.values(members).map((member) => JSON.parse(member));
}

export function getActiveMemberCount(redisClient: RedisClient, nspRoomId: string): Promise<number> {
  return cache.getActiveMemberCountByRoomId(redisClient, nspRoomId);
}

export async function isActiveMember(
  redisClient: RedisClient,
  connectionId: string,
  nspRoomId: string
): Promise<boolean> {
  const activeMember = await cache.isActiveMember(redisClient, connectionId, nspRoomId);

  return !!activeMember;
}

export function dedupeActiveMembers(members: any[] = []): any[] {
  const dedupedMembers: any[] = [];

  for (const member of members) {
    const { clientId } = member;

    if (!dedupedMembers.find((m) => m.clientId === clientId)) {
      dedupedMembers.push(member);
    }
  }

  return dedupedMembers;
}
