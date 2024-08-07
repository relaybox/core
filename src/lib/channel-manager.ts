import { Logger } from 'winston';
import { eventEmitter } from './event-bus';
import { Connection, Channel } from 'rabbitmq-client';
import { getLogger } from '../util/logger';
import { SocketSubscriptionEvent } from '../types/socket.types';
import ConfigManager from './config-manager';

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
  static AMQP_ROUTING_KEY_PREFIX = '$$';

  private logger: Logger = getLogger('channel-manager');

  constructor(instanceId: string | number) {
    this.instanceId = instanceId;
    this.exchange = ConfigManager.AMQP_DEFAULT_EXCHANGE_NAME;
    this.queueCount = ConfigManager.getInt('RABBIT_MQ_QUEUE_COUNT');

    eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_CREATE, this.bindRoom.bind(this));
    eventEmitter.on(SocketSubscriptionEvent.SUBSCRIPTION_DELETE, this.unbindRoom.bind(this));
  }

  public async createChannel(connection: Connection): Promise<void> {
    this.connection = connection;
    this.channel = await connection.acquire();
    this.logger.info(`Channel initialized`);

    this.channel.on('close', this.handleClose.bind(this));
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

  private async bindRoom(roomId: string): Promise<void> {
    try {
      const queueName = this.getQueueName(roomId);

      await this.channel.queueBind({
        exchange: this.exchange,
        queue: queueName,
        routingKey: roomId
      });
    } catch (err) {
      this.logger.error(`Unable to bind queue`, { roomId, err });
    }
  }

  private async unbindRoom(roomId: string): Promise<void> {
    try {
      const queueName = this.getQueueName(roomId);

      await this.channel.queueUnbind({
        exchange: this.exchange,
        queue: queueName,
        routingKey: roomId
      });
    } catch (err) {
      this.logger.error(`Unable to unbind queue`, { roomId, err });
    }
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

  static getRoutingKey(nspRoomId: string): string {
    const [appPid, roomId] = nspRoomId.split(/:(.+)/);
    const hashedNamespace = this.gethashedNamespace(roomId);

    return `${ChannelManager.AMQP_ROUTING_KEY_PREFIX}:${appPid}:${hashedNamespace}`;
  }

  static gethashedNamespace(namespace: string): number {
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
}
