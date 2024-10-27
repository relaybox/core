import { getLogger } from '@/util/logger';
import { Connection, Envelope, Publisher, PublisherProps } from 'rabbitmq-client';

const logger = getLogger('publisher');

const AMQP_CONNECTION_STRING = process.env.RABBIT_MQ_CONNECTION_STRING;
const AMQP_EXCHANGE_NAME = 'ds.persistence.durable';
const AMQP_QUEUE_TYPE = 'direct';
const AMQP_MAX_RETRY_ATTEMPTS = 2;
const AMQP_ROUTING_KEY = 'message.persist';

const connection = new Connection(AMQP_CONNECTION_STRING);

let publisher: Publisher | null = null;

export function getPublisher(): Publisher {
  if (publisher) {
    logger.error(`Publisher already initialized`);
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

export async function enqueueMessage(data: any): Promise<void> {
  logger.debug(`Enqueuing message`, { data });

  if (!publisher) {
    logger.error(`Publisher not initialized`);
    return;
  }

  try {
    const envelope: Envelope = {
      exchange: AMQP_EXCHANGE_NAME,
      routingKey: AMQP_ROUTING_KEY
    };

    const message = {
      data
    };

    await publisher.send(envelope, message);
  } catch (err: unknown) {
    logger.error(`Failed to enqueue message`, { err });
  }
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
