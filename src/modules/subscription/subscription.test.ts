import { RedisClient } from 'src/lib/redis';
import { Session } from 'src/types/session.types';
import { KeyNamespace, KeyPrefix } from 'src/types/state.types';
import { WebSocket } from 'uWebSockets.js';
import { describe, expect, vi, it, beforeEach, afterEach } from 'vitest';
import {
  bindSubscription,
  unbindAllSubscriptions,
  unbindSubscription
} from './subscription.service';

const mockSubscriptionRepository = vi.hoisted(() => {
  return {
    createSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    getAllSubscriptions: vi.fn()
  };
});

vi.mock('./subscription.repository', () => mockSubscriptionRepository);

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

      await unbindAllSubscriptions(redisClient, connectionId, nspRoomId, keyNamespace, socket);

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
