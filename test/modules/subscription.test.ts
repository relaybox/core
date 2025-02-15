import { RedisClient } from '@/lib/redis';
import { Session } from '@/types/session.types';
import { KeyNamespace, KeyPrefix } from '@/types/state.types';
import { WebSocket } from 'uWebSockets.js';
import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import {
  bindSubscription,
  unbindAllSubscriptions,
  unbindSubscription
} from '@/modules/subscription/subscription.service';
import { getLogger } from '@/util/logger';

const logger = getLogger('');

const mockSubscriptionRepository = vi.hoisted(() => ({
  createSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  getAllSubscriptions: vi.fn()
}));

vi.mock('@/modules/subscription/subscription.cache', () => mockSubscriptionRepository);

describe('subscription.service', () => {
  let redisClient: RedisClient;
  let socket: WebSocket<Session>;

  beforeEach(() => {
    redisClient = {} as RedisClient;
    socket = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn()
    } as unknown as WebSocket<Session>;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('bindSubscription', async () => {
    it('should bind a named subscription to a client by connection id', async () => {
      const connectionId = '12345';
      const keyNamespace = KeyNamespace.SUBSCRIPTIONS;
      const nspRoomId = 'room1';
      const subscription = 'subscription:join';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${keyNamespace}:${nspRoomId}`;

      await bindSubscription(
        logger,
        redisClient,
        connectionId,
        nspRoomId,
        subscription,
        keyNamespace,
        socket
      );

      expect(mockSubscriptionRepository.createSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        subscription
      );
      expect(socket.subscribe).toHaveBeenCalledWith(subscription);
    });
  });

  describe('unbindSubscription', async () => {
    it('should unbind a named subscription from a client by connection id', async () => {
      const connectionId = '12345';
      const keyNamespace = KeyNamespace.SUBSCRIPTIONS;
      const nspRoomId = 'room1';
      const subscription = 'subscription:join';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${keyNamespace}:${nspRoomId}`;

      await unbindSubscription(
        logger,
        redisClient,
        connectionId,
        nspRoomId,
        subscription,
        keyNamespace,
        socket
      );

      expect(mockSubscriptionRepository.deleteSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        subscription
      );
      expect(socket.unsubscribe).toHaveBeenCalledWith(subscription);
    });
  });

  describe('unbindAllSubscriptions', async () => {
    it('should unbind all subscriptions from a client by connection id', async () => {
      const connectionId = '12345';
      const keyNamespace = KeyNamespace.SUBSCRIPTIONS;
      const nspRoomId = 'room1';
      const expectedCacheKey = `${KeyPrefix.CONNECTION}:${connectionId}:${keyNamespace}:${nspRoomId}`;

      mockSubscriptionRepository.getAllSubscriptions.mockResolvedValue([
        'subscription:join',
        'subscription:leave'
      ]);

      await unbindAllSubscriptions(
        logger,
        redisClient,
        connectionId,
        nspRoomId,
        keyNamespace,
        socket
      );

      expect(mockSubscriptionRepository.getAllSubscriptions).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey
      );
      expect(mockSubscriptionRepository.deleteSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        'subscription:join'
      );
      expect(mockSubscriptionRepository.deleteSubscription).toHaveBeenCalledWith(
        redisClient,
        expectedCacheKey,
        'subscription:leave'
      );
    });
  });
});
