import { Connection, Envelope, Publisher, PublisherProps } from 'rabbitmq-client';
import { getLogger } from '../util/logger';
import { Logger } from 'winston';
import ConfigManager, { ExchangeType } from './config-manager';

export const MAX_DELIVERY_ATTEMPTS = 2;

export default class PublisherManager {
  private exchange: string;
  private exchangeType: ExchangeType;
  private publisher: Publisher;

  private logger: Logger = getLogger('pubisher-manager');

  constructor() {
    this.exchange = ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME;
    this.exchangeType = ConfigManager.EXCHANGE_TYPE;
  }

  public createPublisher(connection: Connection): Publisher {
    const publisherOptions: PublisherProps = {
      confirm: true,
      maxAttempts: MAX_DELIVERY_ATTEMPTS,
      exchanges: [
        {
          exchange: this.exchange,
          type: this.exchangeType,
          durable: true
        }
      ]
    };

    this.publisher = connection.createPublisher(publisherOptions);

    this.logger.info(`Pubisher initialized`);

    return this.publisher;
  }

  public publishMessage(envelope: Envelope, body: any): Promise<void> {
    return this.publisher.send(envelope, body);
  }
}
