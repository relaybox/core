import { mockQueue } from 'src/test/__mocks__/external/bullmq';
import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import { getMockSession } from '@/modules/session/session.mock';
import { getReducedSession } from '@/modules/session/session.service';
import {
  enqueueDeliveryMetrics,
  publishMetric,
  pushRoomJoinMetrics,
  pushRoomLeaveMetrics,
  unpublishMetric
} from './metrics.service';
import { MetricType } from '@/types/metric.types';
import { MetricsJobName } from './metrics.queue';
import { RedisClient } from '@/lib/redis';

const mockPresenceService = vi.hoisted(() => ({
  isActiveMember: vi.fn()
}));

vi.mock('@/modules/presence/presence.service', () => mockPresenceService);

describe('metrics.service', () => {
  const uid = '12345';
  const nspRoomId = 'nsp:chat:one';
  const metricType = MetricType.CONNECTION;
  const session = getMockSession({ uid });

  let redisClient: RedisClient;

  beforeEach(() => {
    redisClient = {} as RedisClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('publishMetric', () => {
    it('should push publish metrics job to metrics queue', async () => {
      const reducedSession = getReducedSession(session);

      const jobData = {
        uid,
        nspRoomId,
        metricType,
        session: reducedSession
      };

      await publishMetric(uid, nspRoomId, metricType, session);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MetricsJobName.METRICS_PUSH,
        jobData,
        expect.any(Object)
      );
    });
  });

  describe('unpublishMetric', () => {
    it('should push unpublish metrics job to metrics queue', async () => {
      const reducedSession = getReducedSession(session);

      const jobData = {
        uid,
        nspRoomId,
        metricType,
        session: reducedSession
      };

      await unpublishMetric(uid, nspRoomId, metricType, session);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MetricsJobName.METRICS_SHIFT,
        jobData,
        expect.any(Object)
      );
    });
  });

  describe('pushRoomJoinMetrics', () => {
    const roomId = 'chat:one';

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should push aggregated client romm join metrics based on all permissions', async () => {
      const session = getMockSession({
        uid,
        permissions: {
          'chat:*': ['subscribe', 'publish', 'metrics', 'presence', 'history']
        }
      });

      const reducedSession = getReducedSession(session);
      const timestamp = new Date().toISOString();

      mockPresenceService.isActiveMember.mockResolvedValue(true);

      const jobData = {
        uid: session.uid,
        nspRoomId,
        metrics: ['connection', 'subscriber', 'publisher', 'presenceSubscriber', 'presenceMember'],
        timestamp,
        session: reducedSession
      };

      await pushRoomJoinMetrics(redisClient, session, roomId, nspRoomId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MetricsJobName.METRICS_CLIENT_ROOM_JOIN,
        jobData,
        expect.any(Object)
      );
    });

    it('should push aggregated client romm join metrics based on a subset of permissions', async () => {
      const session = getMockSession({
        uid,
        permissions: {
          'chat:*': ['subscribe', 'publish', 'metrics']
        }
      });

      const reducedSession = getReducedSession(session);
      const timestamp = new Date().toISOString();

      mockPresenceService.isActiveMember.mockResolvedValue(false);

      const jobData = {
        uid: session.uid,
        nspRoomId,
        metrics: ['connection', 'subscriber', 'publisher'],
        timestamp,
        session: reducedSession
      };

      await pushRoomJoinMetrics(redisClient, session, roomId, nspRoomId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        MetricsJobName.METRICS_CLIENT_ROOM_JOIN,
        jobData,
        expect.any(Object)
      );
    });
  });

  describe('pushRoomLeaveMetrics', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should push aggregated client room leave metrics by uid', async () => {
      const timestamp = new Date().toISOString();
      const reducedSession = getReducedSession(session);

      await pushRoomLeaveMetrics(uid, nspRoomId, session);

      const jobData = expect.objectContaining({
        uid,
        nspRoomId,
        metrics: ['connection', 'subscriber', 'publisher', 'presenceSubscriber', 'presenceMember'],
        timestamp,
        session: reducedSession
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        MetricsJobName.METRICS_CLIENT_ROOM_LEAVE,
        jobData,
        expect.any(Object)
      );
    });
  });

  describe('enqueueDeliveryMetrics', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should push message delivery metrics to metric queue', async () => {
      const event = 'custom';
      const data = {};
      const requestId = '12345';
      const latencyLog = {
        createdAt: '2023-09-21T08:00:00.000Z',
        receivedAt: '2023-09-21T08:00:00.000Z'
      };
      const listener = `${nspRoomId}::custom`;
      const recipientCount = 2;
      const timestamp = new Date().toISOString();

      const jobData = {
        nspRoomId,
        event,
        recipientCount,
        data,
        requestId,
        session,
        latencyLog,
        listener,
        timestamp
      };

      await enqueueDeliveryMetrics(
        nspRoomId,
        event,
        data,
        requestId,
        session,
        latencyLog,
        listener,
        recipientCount
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        MetricsJobName.METRICS_DELIVERY_DATA,
        jobData,
        expect.any(Object)
      );
    });
  });
});
