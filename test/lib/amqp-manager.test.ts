import { mockApp } from '../__mocks__/external/uWebsockets';
import AmqpManager from '@/lib/topic-exchange/amqp-manager';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import ConnectionManager from '@/lib/topic-exchange/connection-manager';
import ConfigManager from '@/lib/topic-exchange/config-manager';
import MessageHandler from '@/lib/topic-exchange/message-handler';
import ConsumerManager from '@/lib/topic-exchange/consumer-manager';
import ChannelManager from '@/lib/topic-exchange/channel-manager';
import PublisherManager from '@/lib/topic-exchange/publisher-manager';
import DispatchHandler from '@/lib/topic-exchange/dispatch-handler';
import EventEmitter from 'events';

const mockLogger = vi.hoisted(() => ({
  getLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    info: vi.fn()
  })
}));

vi.mock('@/lib/topic-exchange/connection-manager', () => ({
  default: {
    getInstance: vi.fn().mockReturnValue({
      connect: vi.fn()
    })
  }
}));

vi.mock('@/util/logger', () => mockLogger);
vi.mock('@/lib/topic-exchange/config-manager');
vi.mock('@/lib/topic-exchange/message-handler');
vi.mock('@/lib/topic-exchange/consumer-manager');
vi.mock('@/lib/topic-exchange/channel-manager');
vi.mock('@/lib/topic-exchange/publisher-manager');
vi.mock('@/lib/topic-exchange/dispatch-handler');

describe('amqp-manager', () => {
  const mockEventEmitter = new EventEmitter();

  const enqueueDeliveryMetrics = vi.fn();

  const instanceConfig = {
    instanceId: 'test-instance',
    enqueueDeliveryMetrics
  };

  beforeAll(() => {
    AmqpManager.getInstance(mockApp, mockEventEmitter, instanceConfig);
  });

  describe('getInstance', () => {
    it('should return a singleton instance of AmqpManager', async () => {
      const instance1 = AmqpManager.getInstance();
      const instance2 = AmqpManager.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1['instanceId']).toBe(instanceConfig.instanceId);
      expect(mockLogger.getLogger).toHaveBeenCalledWith('amqp-manager');
      expect(ConnectionManager.getInstance).toHaveBeenCalled();
      expect(MessageHandler).toHaveBeenCalledWith(mockApp, instanceConfig.enqueueDeliveryMetrics);
      expect(ConfigManager.get).toHaveBeenCalledWith('RABBIT_MQ_CONNECTION_STRING');
      expect(ConsumerManager).toHaveBeenCalledWith(
        instanceConfig.instanceId,
        instance1['messageHandler']
      );
      expect(ChannelManager).toHaveBeenCalledWith(instanceConfig.instanceId, mockEventEmitter);
      expect(PublisherManager).toHaveBeenCalled();
      expect(ConfigManager.get).toHaveBeenCalledWith('RABBIT_MQ_CONNECTION_STRING');
    });
  });

  describe('connect', () => {
    it('should run connection configuaration', async () => {
      const amqpManager = AmqpManager.getInstance();

      const connection = await amqpManager.connect();

      expect(amqpManager['connectionManager'].connect).toHaveBeenCalledWith(
        amqpManager['connectionString']
      );
      expect(amqpManager['channelManager'].createChannel).toHaveBeenCalledWith(connection);
      expect(amqpManager['consumerManager'].createConsumers).toHaveBeenCalledWith(connection);
      expect(amqpManager['publisherManager'].createPublisher).toHaveBeenCalledWith(connection);
      expect(amqpManager['dispatchHandler']).toBeInstanceOf(DispatchHandler);
    });
  });
});
