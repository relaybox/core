import { getLogger } from '@/util/logger';
import { Connection, Envelope, Publisher, PublisherProps } from 'rabbitmq-client';

const logger = getLogger('publisher');

export const AMQP_CONNECTION_STRING = process.env.RABBIT_MQ_CONNECTION_STRING;
export const AMQP_EXCHANGE_NAME = 'ds.persistence.durable';
export const AMQP_QUEUE_TYPE = 'direct';
export const AMQP_MAX_RETRY_ATTEMPTS = 2;
export const AMQP_ROUTING_KEY = 'message.persist';

const connection = new Connection(AMQP_CONNECTION_STRING);

let publisher: Publisher | null = null;

export function getPublisher(): Publisher {
  if (publisher) {
    return publisher;
  }

  logger.info('Creating amqp publisher');

  const publisherOptions: PublisherProps = {
    confirm: true,
    maxAttempts: AMQP_MAX_RETRY_ATTEMPTS,
    exchanges: [
      {
        exchange: AMQP_EXCHANGE_NAME,
        type: AMQP_QUEUE_TYPE,
        durable: true
      }
    ]
  };

  publisher = connection.createPublisher(publisherOptions);

  return publisher;
}

export async function cleanupAmqpPublisher() {
  if (publisher) {
    try {
      await publisher.close();
    } catch (err) {
      logger.error('Error ending amqp publisher', { err });
    } finally {
      logger.info('Amqp publisher disconnected through app termination');
      publisher = null;
    }
  }
}
