import { Job } from 'bullmq';
import { MetricType } from '@/types/metric.types';
import { ReducedSession, Session } from '@/types/session.types';
import { hasPermission, matchRoomPermissions } from '@/modules/permissions/permissions.service';
import { DsPermission } from '@/types/permissions.types';
import { MetricsJobName, defaultJobConfig, metricsQueue } from './metrics.queue';
import { getReducedSession } from '@/modules/session/session.service';
import { LatencyLog } from 'src/types/request.types';
import { RedisClient } from 'src/lib/redis';
import { isActiveMember } from '@/modules/presence/presence.service';
import { RoomType } from '@/types/room.types';

export function publishMetric(
  uid: string,
  nspRoomId: string,
  metricType: MetricType,
  session: Session
): Promise<Job> {
  const reducedSession = getReducedSession(session);

  const jobData = {
    uid,
    nspRoomId,
    metricType,
    session: reducedSession
  };

  return metricsQueue.add(MetricsJobName.METRICS_PUSH, jobData, defaultJobConfig);
}

export function unpublishMetric(
  uid: string,
  nspRoomId: string,
  metricType: MetricType,
  session: Session
): Promise<Job> {
  const reducedSession = getReducedSession(session);

  const jobData = {
    uid,
    nspRoomId,
    metricType,
    session: reducedSession
  };

  return metricsQueue.add(MetricsJobName.METRICS_SHIFT, jobData, defaultJobConfig);
}

export async function pushRoomJoinMetrics(
  redisClient: RedisClient,
  session: Session,
  roomId: string,
  nspRoomId: string
): Promise<void> {
  const metrics = [];

  const { uid, permissions } = session;

  metrics.push(MetricType.CONNECTION);

  const attachedPermissions = matchRoomPermissions(roomId, permissions);

  const pushMetrics: [DsPermission, MetricType][] = [
    [DsPermission.SUBSCRIBE, MetricType.SUBSCRIBER],
    [DsPermission.PUBLISH, MetricType.PUBLISHER],
    [DsPermission.PRESENCE, MetricType.PRESENCE_SUBSCRIBER]
  ];

  for (const [permission, metricType] of pushMetrics) {
    if (hasPermission(attachedPermissions, permission)) {
      metrics.push(metricType);
    }
  }

  const timestamp = new Date().toISOString();
  const reducedSession = getReducedSession(session);
  const activeMember = await isActiveMember(redisClient, uid, nspRoomId);

  if (activeMember) {
    metrics.push(MetricType.PRESENCE_MEMBER);
  }

  const jobData = {
    uid,
    roomId,
    nspRoomId,
    metrics,
    timestamp,
    session: reducedSession
  };

  metricsQueue.add(MetricsJobName.METRICS_CLIENT_ROOM_JOIN, jobData, defaultJobConfig);
}

export function pushRoomLeaveMetrics(
  uid: string,
  nspRoomId: string,
  session?: Session
): Promise<Job> {
  const timestamp = new Date().toISOString();

  const metrics = [
    MetricType.CONNECTION,
    MetricType.SUBSCRIBER,
    MetricType.PUBLISHER,
    MetricType.PRESENCE_SUBSCRIBER,
    MetricType.PRESENCE_MEMBER
  ];

  const jobData = {
    uid,
    nspRoomId,
    metrics,
    timestamp,
    ...(session && { session: getReducedSession(session) })
  };

  return metricsQueue.add(MetricsJobName.METRICS_CLIENT_ROOM_LEAVE, jobData, defaultJobConfig);
}

export function enqueueDeliveryMetrics(
  nspRoomId: string,
  event: string,
  data: any,
  requestId: string,
  session: ReducedSession,
  latencyLog: LatencyLog,
  listener: string,
  recipientCount?: number
): Promise<Job> {
  const timestamp = new Date().toISOString(); // Populates pg "dispatchedAt" column

  const deliveryData = {
    nspRoomId,
    event,
    recipientCount,
    data,
    requestId,
    session,
    latencyLog,
    timestamp,
    listener
  };

  return metricsQueue.add(MetricsJobName.METRICS_DELIVERY_DATA, deliveryData, defaultJobConfig);
}

export function getLatencyLog(createdAt: string): LatencyLog {
  const receivedAt = new Date().toISOString();

  return {
    createdAt,
    receivedAt
  };
}
