import '../__mocks__/external/rabbitmq-client';
import Connection, { Envelope } from 'rabbitmq-client';
import ConnectionManager from '@/lib/connection-manager';
import PublisherManager, { MAX_DELIVERY_ATTEMPTS } from '@/lib/publisher-manager';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConfigManager from '@/lib/config-manager';

describe('publisher-manager', () => {
  let connection: Connection;

  beforeEach(() => {
    const connectionManager = ConnectionManager.getInstance();
    connection = connectionManager.connect('amqp://localhost');
  });

  afterEach(() => {
    ConnectionManager.destroyInstance();
  });

  afterAll(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('createPublisher', () => {
    it('should create a publisher instance', () => {
      const publisherManager = new PublisherManager();
      const publisher = publisherManager.createPublisher(connection);
      const exchange = ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME;

      expect(connection.createPublisher).toHaveBeenCalledWith(
        expect.objectContaining({
          confirm: true,
          maxAttempts: MAX_DELIVERY_ATTEMPTS,
          exchanges: expect.arrayContaining([
            expect.objectContaining({
              exchange
            })
          ])
        })
      );
      expect(connection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(publisher.send).toBeDefined();
    });
  });

  describe('publishMessage', () => {
    it('should publish a message based on provided envelope and body', () => {
      const publisherManager = new PublisherManager();
      const publisher = publisherManager.createPublisher(connection);

      const envelope = {} as Envelope;
      const body = {};

      publisherManager.publishMessage(envelope, body);

      expect(publisher.send).toHaveBeenCalledWith(envelope, body);
    });
  });
});
