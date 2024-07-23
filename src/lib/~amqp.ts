import { v4 as uuid } from 'uuid';
import {
  Connection,
  Consumer,
  ConsumerProps,
  Channel,
  PublisherProps,
  Envelope,
  Publisher
} from 'rabbitmq-client';
import { getLogger } from '../util/logger';
import { Logger } from 'winston';
import { Job } from 'bullmq';
import { ReducedSession } from '../types/session.types';
import { LatencyLog } from 'src/types/request.types';
import { eventEmitter } from './event-bus';
import { SocketSubscriptionEvent } from '../types/socket.types';
import { TemplatedApp } from 'uWebSockets.js';

const AMQP_DEFAULT_EXCHANGE_NAME = 'ds.rooms';
const AMQP_QUEUE_COUNT = Number(process.env.RABBIT_MQ_QUEUE_COUNT || 5);
const AMQP_QUEUE_NAME_PREFIX = 'queue';
const AMQP_QUEUE_AUTO_DELETE = process.env.RABBIT_MQ_QUEUE_AUTO_DELETE === 'true';

enum ExchangeType {
  TOPIC = 'topic'
}

interface AmqpConfig {
  instanceId: number;
  exchange?: string;
  exchangeType?: ExchangeType;
  enqueueDeliveryMetrics: (...args: any) => Promise<Job>;
}

interface Dispatcher {
  dispatch: (event: string, data: any, session: ReducedSession, latancyLog: LatencyLog) => void;
}

interface Message {
  event: string;
  data: any;
  nspRoomId: string;
  session: ReducedSession;
  requestId: string;
  latencyLog: LatencyLog;
  global?: boolean;
}

export class AmqpManager {
  private app: TemplatedApp;
  private logger: Logger;
  private amqpConnection;
  private connectionString = process.env.RABBIT_MQ_CONNECTION_STRING;
  private consumers: Consumer[];
  private publisher: Publisher;
  private exchange: string;
  private exchangeType: string;
  private channel: Channel;
  private instanceId: string | number;
  private enqueueDeliveryMetrics: (...args: any) => Promise<Job>;

  constructor(app: TemplatedApp, opts: AmqpConfig) {
    this.logger = getLogger(`amqp`);

    this.app = app;
    this.instanceId = opts.instanceId;
    this.exchange = opts?.exchange || AMQP_DEFAULT_EXCHANGE_NAME;
    this.exchangeType = opts?.exchangeType || ExchangeType.TOPIC;
    this.amqpConnection = this.createConnection(this.connectionString!);
    this.consumers = this.createConsumers();
    this.publisher = this.createPublisher();
    this.enqueueDeliveryMetrics = opts.enqueueDeliveryMetrics;

    this.logger.info(`Connection established`);
  }

  async connect() {
    this.channel = await this.createChannel();

    eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_CREATE, this.bindRoom.bind(this));
    eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_DELETE, this.unbindRoom.bind(this));

    this.logger.info(`Socket.io actions queue bindings complete`);

    return this;
  }

  private createConnection(connectionString: string): Connection {
    const connection = new Connection(connectionString);

    connection.on('error', (err: any) => {
      this.logger.error(`Connection error`, { err });
    });

    return connection;
  }

  async createChannel() {
    return this.amqpConnection.acquire();
  }

  private createConsumers() {
    return [...Array(AMQP_QUEUE_COUNT).keys()].map((key, i) => {
      const queueName = `${this.instanceId}-${AMQP_QUEUE_NAME_PREFIX}-${i}`;

      const queueOptions = {
        durable: true,
        autoDelete: AMQP_QUEUE_AUTO_DELETE
      };

      const qos = {
        prefetchCount: 20
      };

      const consumerOptions: ConsumerProps = {
        concurrency: 5,
        queue: queueName,
        requeue: true,
        queueOptions,
        qos,
        exchanges: [
          {
            exchange: this.exchange,
            type: this.exchangeType
          }
        ],
        queueBindings: [
          {
            exchange: this.exchange
          }
        ]
      };

      const consumer = this.amqpConnection.createConsumer(
        consumerOptions,
        this.handleMessage.bind(this)
      );

      consumer.on('error', (err: any) => {
        this.logger.error(`Consumer error`, { err, queueName });
      });

      return consumer;
    });
  }

  private async bindRoom(room: string) {
    try {
      const routingKey = this.getBindingKey(room);
      const queueName = this.getQueueName(routingKey);

      // const queueName = this.getQueueName(room);
      // const routingKey = this.getRoutingKey(room);

      await this.channel.queueBind({
        exchange: this.exchange,
        queue: queueName,
        routingKey
      });
    } catch (err) {
      this.logger.error(`Unable to bind queue`, { room, err });
    }
  }

  private async unbindRoom(room: string) {
    try {
      const routingKey = this.getBindingKey(room);
      const queueName = this.getQueueName(routingKey);

      // const queueName = this.getQueueName(room);
      // const routingKey = this.getRoutingKey(room);

      await this.channel.queueUnbind({
        exchange: this.exchange,
        queue: queueName,
        routingKey
      });
    } catch (err) {
      this.logger.error(`Unable to unbind queue`, { room, err });
    }
  }

  private getBindingKey(room: string): string {
    const [appPid, namespace] = room.split(':');

    return `${appPid}.${namespace}.#`;
  }

  private async handleMessage(msg: any) {
    this.logger.info(`Received message, preparing to distribute`, { msg });

    const { nspRoomId, event, data, requestId, session, latencyLog } = msg.body;

    try {
      this.emitAndLogMetrics(event, data, nspRoomId, requestId, session, latencyLog);
      this.emitAndLogMetrics(
        `${nspRoomId}::$:subscribe:all`,
        data,
        nspRoomId,
        requestId,
        session,
        latencyLog,
        event
      );
    } catch (err) {
      this.logger.error(`Message handler failed`, { msg, err });
      throw err;
    }
  }

  private formatMessageEventData(event: string, data: any): string {
    const messageEventData = {
      type: event,
      body: data
    };

    return JSON.stringify(messageEventData);
  }

  private emitAndLogMetrics(
    event: string,
    data: any,
    nspRoomId: string,
    requestId: string,
    session: any,
    latencyLog: any,
    forEvent?: string
  ) {
    const messageEventData = this.formatMessageEventData(event, data);

    this.app.publish(event, messageEventData);
    this.handleDeliveryMetrics(nspRoomId, event, data, requestId, session, latencyLog, forEvent);
  }

  private async handleDeliveryMetrics(
    nspRoomId: string,
    event: string,
    data: any,
    requestId: string,
    session: ReducedSession,
    latencyLog: LatencyLog,
    forEvent?: string
  ): Promise<void> {
    try {
      const recipientCount = this.app.numSubscribers(event);

      if (!recipientCount) {
        return;
      }

      const job = await this.enqueueDeliveryMetrics(
        nspRoomId,
        forEvent || event,
        data,
        requestId,
        session,
        latencyLog,
        event,
        recipientCount
      );

      this.logger.info(`Message dispatched to ${recipientCount} sockets`, {
        nspRoomId,
        event,
        jobId: job.id
      });
    } catch (err) {
      this.logger.error(`Failed to enqueue delivery metrics`, {
        nspRoomId,
        event,
        err
      });
    }
  }

  private createPublisher() {
    this.logger.info(`Creating publisher`);

    const publisherOptions: PublisherProps = {
      confirm: true,
      maxAttempts: 2,
      exchanges: [
        {
          exchange: this.exchange,
          type: this.exchangeType
        }
      ]
    };

    return this.amqpConnection.createPublisher(publisherOptions);
  }

  to(nspRoomId: string): Dispatcher {
    const $_self = this;

    return {
      dispatch: (event, data, session, latencyLog) => {
        return $_self.handleDispatch(nspRoomId, event, data, session, latencyLog);
      }
    };
  }

  private handleDispatch(
    nspRoomId: string,
    event: string,
    data: any,
    session: ReducedSession,
    latencyLog: LatencyLog
  ): void {
    const envelope: Envelope = {
      exchange: this.exchange,
      routingKey: this.getRoutingKey(event)
    };

    const message = this.buildMessage(nspRoomId, event, data, session, latencyLog);

    this.publisher.send(envelope, message);
  }

  private buildMessage(
    nspRoomId: string,
    event: string,
    data: any,
    session: ReducedSession,
    latencyLog: LatencyLog,
    global?: boolean
  ): Message {
    const requestId = uuid();

    return {
      nspRoomId,
      event,
      data,
      session,
      latencyLog,
      requestId,
      global
    };
  }

  private getRoutingKey(room: string) {
    try {
      return room;
    } catch (err: any) {
      this.logger.error(`Unable to create routing key for ${room}`, { err });
    }
  }

  private getQueueName(room: string) {
    const queueIndex = this.getQueueIndex(room);
    return `${this.instanceId}-${AMQP_QUEUE_NAME_PREFIX}-${queueIndex}`;
  }

  private getQueueIndex(room: string) {
    let hash = 0;
    let chr: number;

    for (let i = 0; i < room.length; i++) {
      chr = room.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }

    return ((hash % AMQP_QUEUE_COUNT) + AMQP_QUEUE_COUNT) % AMQP_QUEUE_COUNT;
  }

  getNspRoomId(appPid: string, room: string): string {
    return `${appPid}:${room}`;
  }

  getNspEvent(nspRoomId: string, event: string): string {
    return `${nspRoomId}::${event}`;
  }
}
