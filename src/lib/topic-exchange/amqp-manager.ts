import { TemplatedApp } from 'uWebSockets.js';
import { getLogger } from '@/util/logger';
import { Logger } from 'winston';
import ConfigManager, { AmqpConfig } from './config-manager';
import ConnectionManager from './connection-manager';
import ConsumerManager from './consumer-manager';
import MessageHandler from './message-handler';
import ChannelManager from './channel-manager';
import PublisherManager from './publisher-manager';
import DispatchHandler from './dispatch-handler';
import EventEmitter from 'events';

export default class AmqpManager {
  private static instance: AmqpManager;

  private instanceId: string | number;
  private eventEmitter: EventEmitter;
  private connectionString?: string;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private consumerManager: ConsumerManager;
  private channelManager: ChannelManager;
  private publisherManager: PublisherManager;
  public dispatchHandler: DispatchHandler;

  private logger: Logger = getLogger('amqp-manager');

  constructor(app: TemplatedApp, eventEmitter: EventEmitter, config: AmqpConfig) {
    this.instanceId = config.instanceId;
    this.eventEmitter = eventEmitter;
    this.connectionString = ConfigManager.get('RABBIT_MQ_CONNECTION_STRING');
    this.connectionManager = ConnectionManager.getInstance();
    this.messageHandler = new MessageHandler(app, config.enqueueDeliveryMetrics);
    this.consumerManager = new ConsumerManager(this.instanceId, this.messageHandler);
    this.channelManager = new ChannelManager(this.instanceId, this.eventEmitter);
    this.publisherManager = new PublisherManager();
  }

  public static getInstance(
    app?: TemplatedApp,
    eventEmitter?: EventEmitter,
    config?: AmqpConfig
  ): AmqpManager {
    if (AmqpManager.instance) {
      return AmqpManager.instance;
    }

    if (!app || !eventEmitter || !config) {
      throw Error(`Missing arguments "app", "eventEmitter" and "config"`);
    }

    AmqpManager.instance = new AmqpManager(app!, eventEmitter!, config!);

    return AmqpManager.instance;
  }

  public async connect() {
    try {
      const connection = this.connectionManager.connect(this.connectionString!);
      await this.channelManager.createChannel(connection);
      this.consumerManager.createConsumers(connection);
      const publisher = this.publisherManager.createPublisher(connection);
      this.dispatchHandler = new DispatchHandler(publisher);

      return connection;
    } catch (err: any) {
      this.logger.error(`Failed to initialize AMQP manager`, { err });
      throw err;
    }
  }
}
