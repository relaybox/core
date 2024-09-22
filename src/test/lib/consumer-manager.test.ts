import 'src/test/__mocks__/external/rabbitmq-client';
import ConnectionManager from 'src/lib/connection-manager';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Connection from 'rabbitmq-client';
import { App } from 'uWebSockets.js';
import MessageHandler from 'src/lib/message-handler';
import ConsumerManager, {
  AMQP_CONSUMER_CONCURRENCY,
  AMQP_QUEUE_NAME_PREFIX
} from 'src/lib/consumer-manager';

vi.mock('src/lib/message-handler');

describe('consumer-manager', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let connection: Connection;
  const instanceId = 'test-instance';
  const app = App();
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
      const messageHandler = new MessageHandler(app, enqueueDeliveryMetrics);
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
