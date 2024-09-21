import { Logger } from 'winston';
import { Connection, Channel } from 'rabbitmq-client';
import { getLogger } from '../util/logger';
import { SocketSubscriptionEvent } from '../types/socket.types';
import ConfigManager from './config-manager';
import EventEmitter from 'events';

const AMQP_QUEUE_NAME_PREFIX = 'queue';

export default class ChannelManager {
  private exchange: string;
  private channel: Channel;
  private instanceId: string | number;
  private queueCount: number;
  private connection: Connection;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds
  private bindings: Map<string, string> = new Map();
  private eventEmitter: EventEmitter;

  static AMQP_ROUTING_KEY_PREFIX = '$$';

  private logger: Logger = getLogger('channel-manager');

  constructor(instanceId: string | number, eventEmitter: EventEmitter) {
    this.instanceId = instanceId;
    this.eventEmitter = eventEmitter;
    this.exchange = ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME;
    this.queueCount = ConfigManager.getInt('RABBIT_MQ_QUEUE_COUNT');

    this.eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_CREATE, this.bindRoom.bind(this));
    this.eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_DELETE, this.unbindRoom.bind(this));
  }

  static getRoutingKey(nspRoomId: string): string {
    const [appPid, roomId] = nspRoomId.split(/:(.+)/);
    const hashedRoomId = this.gethashedRoomId(roomId || appPid);

    return `${ChannelManager.AMQP_ROUTING_KEY_PREFIX}:${appPid}:${hashedRoomId}`;
  }

  static gethashedRoomId(namespace: string): number {
    const queueCount = ConfigManager.getInt('RABBIT_MQ_QUEUE_COUNT') || 20;

    let hash = 0;
    let chr: number;

    for (let i = 0; i < namespace.length; i++) {
      chr = namespace.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }

    return ((hash % queueCount) + queueCount) % queueCount;
  }

  public async createChannel(connection: Connection): Promise<Channel> {
    this.connection = connection;
    this.channel = await connection.acquire();
    this.logger.info(`Channel initialized`);

    this.channel.on('close', this.handleClose.bind(this));

    if (this.bindings.size) {
      this.restoreBindings();
    }

    return this.channel;
  }

  handleClose() {
    this.logger.warn(`Channel closed`);
    this.scheduleChannelReconnect();
  }

  private scheduleChannelReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.logger.info(`Reconnecting in ${this.reconnectDelay / 1000} seconds...`);
      setTimeout(() => this.createChannel(this.connection), this.reconnectDelay);
    } else {
      this.logger.error('Max reconnect attempts reached. Failed to acquire channel');
    }
  }

  private async bindRoom(routingKey: string): Promise<void> {
    try {
      const queueName = this.getQueueName(routingKey);

      await this.channel.queueBind({
        exchange: this.exchange,
        queue: queueName,
        routingKey
      });

      this.bindings.set(routingKey, queueName);
    } catch (err) {
      this.logger.error(`Unable to bind queue`, { routingKey, err });
    }
  }

  private async unbindRoom(routingKey: string): Promise<void> {
    try {
      const queueName = this.getQueueName(routingKey);

      await this.channel.queueUnbind({
        exchange: this.exchange,
        queue: queueName,
        routingKey
      });

      this.bindings.delete(routingKey);
    } catch (err) {
      this.logger.error(`Unable to unbind queue`, { routingKey, err });
    }
  }

  private restoreBindings() {
    this.logger.info(`Restoring bindings`, { size: this.bindings.size });

    this.bindings.forEach((_, roomId) => {
      this.bindRoom(roomId);
    });
  }

  private getQueueName(room: string): string {
    const queueIndex = this.getQueueIndex(room);
    return `${this.instanceId}-${AMQP_QUEUE_NAME_PREFIX}-${queueIndex}`;
  }

  private getQueueIndex(room: string): number {
    let hash = 0;
    let chr: number;

    for (let i = 0; i < room.length; i++) {
      chr = room.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }

    return ((hash % this.queueCount) + this.queueCount) % this.queueCount;
  }
}
