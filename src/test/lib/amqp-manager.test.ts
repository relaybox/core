import { mockApp } from '@/test/__mocks__/external/uWebsockets';
import AmqpManager from '@/lib/amqp-manager';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import ConnectionManager from '@/lib/connection-manager';
import ConfigManager from '@/lib/config-manager';
import MessageHandler from '@/lib/message-handler';
import ConsumerManager from '@/lib/consumer-manager';
import ChannelManager from '@/lib/channel-manager';
import PublisherManager from '@/lib/publisher-manager';
import DispatchHandler from '@/lib/dispatch-handler';
import EventEmitter from 'events';

const mockLogger = vi.hoisted(() => ({
  getLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    info: vi.fn()
  })
}));

vi.mock('@/lib/connection-manager', () => ({
  default: {
    getInstance: vi.fn().mockReturnValue({
      connect: vi.fn()
    })
  }
}));

vi.mock('@/util/logger', () => mockLogger);
vi.mock('@/lib/config-manager');
vi.mock('@/lib/message-handler');
vi.mock('@/lib/consumer-manager');
vi.mock('@/lib/channel-manager');
vi.mock('@/lib/publisher-manager');
vi.mock('@/lib/dispatch-handler');

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
