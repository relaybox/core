import { TemplatedApp } from 'uWebSockets.js';
import { getLogger } from '../util/logger';
import { Logger } from 'winston';
import ConfigManager, { AmqpConfig } from './config-manager';
import ConnectionManager from './connection-manager';
import ConsumerManager from './consumer-manager';
import MessageHandler from './message-handler';
import ChannelManager from './channel-manager';
import PublisherManager from './publisher-manager';
import DispatchHandler from './dispatch-handler';

export default class AmqpManager {
  private static instance: AmqpManager;

  private instanceId: string | number;
  private connectionString?: string;
  private connectionManager: ConnectionManager;
  private messageHandler: MessageHandler;
  private consumerManager: ConsumerManager;
  private channelManager: ChannelManager;
  private publisherManager: PublisherManager;
  public dispatchHandler: DispatchHandler;

  private logger: Logger = getLogger('amqp-manager');

  constructor(app: TemplatedApp, config: AmqpConfig) {
    this.instanceId = config.instanceId;
    this.connectionString = ConfigManager.get('RABBIT_MQ_CONNECTION_STRING');
    this.connectionManager = ConnectionManager.getInstance();
    this.messageHandler = new MessageHandler(app, config.enqueueDeliveryMetrics);
    this.consumerManager = new ConsumerManager(this.instanceId, this.messageHandler);
    this.channelManager = new ChannelManager(this.instanceId);
    this.publisherManager = new PublisherManager();
  }

  public static getInstance(app?: TemplatedApp, config?: AmqpConfig): AmqpManager {
    if (AmqpManager.instance) {
      return AmqpManager.instance;
    }

    if (!app || !config) {
      throw Error(`Missing arguments "app" and "config"`);
    }

    AmqpManager.instance = new AmqpManager(app!, config!);

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
