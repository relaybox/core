import { Connection, Consumer, ConsumerProps } from 'rabbitmq-client';
import { getLogger } from '../util/logger';
import { Logger } from 'winston';
import ConfigManager, { ExchangeType } from './config-manager';
import MessageHandler from './message-handler';

const AMQP_QUEUE_NAME_PREFIX = 'queue';
const AMQP_CONSUMER_CONCURRENCY = 5;
const AMQP_CONSUMER_PREFETCH_COUNT = 20;

export default class ConsumerManager {
  private exchange: string;
  private exchangeType: ExchangeType;
  private queueCount: number = 1;
  private instanceId: string | number;
  private autoDelete: boolean;
  private messageHandler: MessageHandler;
  private consumers: Consumer[] = [];

  private logger: Logger = getLogger('consumer-manager');

  constructor(instanceId: string | number, messageHandler: MessageHandler) {
    this.instanceId = instanceId;
    this.messageHandler = messageHandler;
    this.exchange = ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME;
    this.exchangeType = ConfigManager.EXCHANGE_TYPE;
    this.queueCount = ConfigManager.getInt('RABBIT_MQ_QUEUE_COUNT');
    this.autoDelete = ConfigManager.getBool('RABBIT_MQ_QUEUE_AUTO_DELETE');
    this.consumers = [];
  }

  public createConsumers(connection: Connection): void {
    if (this.consumers.length) {
      this.logger.error(`Consumers already initialized`);
    }

    this.consumers = [...Array(this.queueCount).keys()].map((key, i) => {
      const queueName = `${this.instanceId}-${AMQP_QUEUE_NAME_PREFIX}-${i}`;

      const queueOptions = {
        // durable: true,
        autoDelete: this.autoDelete
      };

      const qos = {
        prefetchCount: AMQP_CONSUMER_PREFETCH_COUNT
      };

      const exchanges = [
        {
          exchange: this.exchange,
          type: this.exchangeType,
          durable: true
        }
      ];

      const queueBindings = [
        {
          exchange: this.exchange
        }
      ];

      const consumerOptions: ConsumerProps = {
        concurrency: AMQP_CONSUMER_CONCURRENCY,
        queue: queueName,
        requeue: false,
        queueOptions,
        qos,
        exchanges,
        queueBindings
      };

      const consumer = connection.createConsumer(
        consumerOptions,
        this.messageHandler.handleMessage.bind(this.messageHandler)
      );

      consumer.on('error', (err: any) => {
        this.logger.error(`Consumer error`, { err, queueName });
      });

      this.logger.info(`Consumer ${queueName} initialized`);

      return consumer;
    });
  }
}
