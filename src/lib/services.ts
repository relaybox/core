import { TemplatedApp } from 'uWebSockets.js';
import AmqpManager from './amqp-manager/amqp-manager';
import { getPgPool } from './pg';
import { getPublisher } from './publisher';
import { getRedisClient, RedisClient } from './redis';
import { eventEmitter } from '@/lib/event-bus';
import { enqueueDeliveryMetrics } from '@/modules/metrics/metrics.service';
import { Pool } from 'pg';
import { Publisher } from 'rabbitmq-client';

export interface Services {
  pgPool: Pool | null;
  redisClient: RedisClient;
  publisher: Publisher;
  amqpManager: AmqpManager;
}

export function createServices(app: TemplatedApp, instanceId: string): Services {
  return {
    pgPool: getPgPool(),
    redisClient: getRedisClient(),
    publisher: getPublisher(),
    amqpManager: AmqpManager.getInstance(app, eventEmitter, {
      instanceId,
      enqueueDeliveryMetrics
    })
  };
}
