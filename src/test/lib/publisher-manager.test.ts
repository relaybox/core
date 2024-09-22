import 'src/test/__mocks__/external/rabbitmq-client';
import Connection, { Envelope } from 'rabbitmq-client';
import ConnectionManager from 'src/lib/connection-manager';
import PublisherManager, { MAX_DELIVERY_ATTEMPTS } from 'src/lib/publisher-manager';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

      expect(connection.createPublisher).toHaveBeenCalledWith(
        expect.objectContaining({
          confirm: true,
          maxAttempts: MAX_DELIVERY_ATTEMPTS
        })
      );
      expect(connection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(publisher.send).toBeDefined();
    });
  });

  describe('publishMessage', () => {
    it('should publish a message to a specified exchange and routing key', () => {
      const publisherManager = new PublisherManager();
      const publisher = publisherManager.createPublisher(connection);

      const envelope = {} as Envelope;
      const body = {};

      publisherManager.publishMessage(envelope, body);

      expect(publisher.send).toHaveBeenCalledWith(envelope, body);
    });
  });
});
