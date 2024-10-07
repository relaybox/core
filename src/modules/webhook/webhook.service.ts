import { WebhookJobName, defaultJobConfig, webhookQueue } from './webhook.queue';
import { getLogger } from '@/util/logger';
import { Session } from '@/types/session.types';
import { v4 as uuid } from 'uuid';
import { WebhookEvent, WebhookPayload } from '@/types/webhook.types';
import { Job } from 'bullmq';

const logger = getLogger('webhook');

export async function enqueueWebhookEvent(
  event: WebhookEvent,
  data: any,
  session: Session
): Promise<Job> {
  const id = uuid();

  logger.debug(`Enqueueing webhook event ${id}, "${event}"`, { id, event, session });

  const jobData: WebhookPayload = {
    id,
    event,
    data,
    session
  };

  return webhookQueue.add(WebhookJobName.WEBHOOK_DISPATCH, jobData, defaultJobConfig);
}
