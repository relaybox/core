import { Job } from 'bullmq';
import { Logger } from 'winston';
import { defaultJobConfig, IntellectJobName, intellectQueue } from './intellect.queue';
import { PersistedMessage } from '@/types/data.types';

export async function enqueueIntellectEvent(
  logger: Logger,
  persistedMessage: PersistedMessage
): Promise<Job> {
  logger.debug(`Enqueuing intellect event`);

  try {
    return await intellectQueue.add(
      IntellectJobName.INTELLECT_INPUT_BASIC,
      persistedMessage,
      defaultJobConfig
    );
  } catch (err: any) {
    logger.error(`Failed to enqueue intellect event:`, err);
    throw err;
  }
}
