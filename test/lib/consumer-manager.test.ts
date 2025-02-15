import '../__mocks__/external/rabbitmq-client';
import { mockApp } from '../__mocks__/external/uWebsockets';
import ConnectionManager from '@/lib/amqp-manager/connection-manager';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Connection from 'rabbitmq-client';
import MessageHandler from '@/lib/amqp-manager/message-handler';
import ConsumerManager, {
  AMQP_CONSUMER_CONCURRENCY,
  AMQP_QUEUE_NAME_PREFIX
} from '@/lib/amqp-manager/consumer-manager';

vi.mock('@/lib/amqp-manager/message-handler');

describe('consumer-manager', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let connection: Connection;

  const instanceId = 'test-instance';
  const enqueueDeliveryMetrics = vi.fn();
  const queueCount = 5;

  beforeAll(() => {
    originalEnv = {
      ...process.env
    };

    process.env.RABBIT_MQ_QUEUE_COUNT = `${queueCount}`;
    process.env.RABBIT_MQ_QUEUE_AUTO_DELETE = 'true';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    const connectionManager = ConnectionManager.getInstance();
    connection = connectionManager.connect('amqp://localhost');
  });

  afterEach(() => {
    ConnectionManager.destroyInstance();
  });

  describe('createConsumers', () => {
    it('should create consumers for each queue', async () => {
      const messageHandler = new MessageHandler(mockApp, enqueueDeliveryMetrics);
      const consumerManager = new ConsumerManager(instanceId, messageHandler);

      consumerManager.createConsumers(connection);

      const expectedConsumerConfig = expect.objectContaining({
        concurrency: AMQP_CONSUMER_CONCURRENCY,
        queue: `${instanceId}-${AMQP_QUEUE_NAME_PREFIX}-1`,
        queueOptions: expect.objectContaining({
          autoDelete: true
        })
      });

      expect(connection.createConsumer).toHaveBeenCalledTimes(queueCount);
      expect(connection.createConsumer).toHaveBeenCalledWith(
        expectedConsumerConfig,
        expect.any(Function)
      );
    });
  });
});
