import { Job } from 'bullmq';

export enum ExchangeType {
  TOPIC = 'topic'
}

export const AMQP_DEFAULT_EXCHANGE_NAME = 'ds.rooms.durable';

export interface AmqpConfig {
  instanceId: string;
  exchange?: string;
  exchangeType?: ExchangeType;
  enqueueDeliveryMetrics: (...args: any) => Promise<Job>;
}

export default class ConfigManager {
  static AMQP_DEFAULT_EXCHANGE_NAME = AMQP_DEFAULT_EXCHANGE_NAME;
  static EXCHANGE_TYPE = ExchangeType.TOPIC;

  static get(key: string): string | undefined {
    return process.env[key];
  }

  static getBool(key: string): boolean {
    return process.env[key] === 'true';
  }

  static getInt(key: string): number {
    if (!process.env[key]) {
      return 0;
    }

    return Number(process.env[key]);
  }
}
