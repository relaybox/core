import { Session } from '@/types/session.types';
import { Job } from 'bullmq';
import { Logger } from 'winston';
import { v4 as uuid } from 'uuid';
import { defaultJobConfig, IntellectJobName, intellectQueue } from './intellect.queue';
import { IntellectPayloadOptions, IntellectPublishOptions } from './intellect.types';

export async function enqueueIntellectEvent(
  logger: Logger,
  appPid: string,
  roomId: string,
  opts: IntellectPublishOptions
): Promise<Job> {
  const id = uuid();
  const timestamp = new Date().toISOString();

  try {
    const jobData: IntellectPayloadOptions = {
      ...opts,
      appPid,
      roomId
    };

    console.log('JOB DATA', jobData);

    return intellectQueue.add(IntellectJobName.INTELLECT_INPUT_BASIC, jobData, defaultJobConfig);
  } catch (err: any) {
    logger.error(`Failed to enqueue webhook event`, { err });
    throw err;
  }
}
