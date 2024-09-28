import { getJsonResponse } from '@/util/http';
import { getLogger } from '@/util/logger';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { v4 as uuid } from 'uuid';

const logger = getLogger('event');

const parseBody = (res: HttpResponse) => {
  return new Promise<string>((resolve) => {
    let buffer: Buffer;

    res.onData((chunk, isLast) => {
      const curBuf = Buffer.from(chunk);

      buffer = buffer ? Buffer.concat([buffer, curBuf]) : isLast ? curBuf : Buffer.concat([curBuf]);

      if (isLast) {
        resolve(buffer.toString());
      }
    });
  });
};

export async function clientEventPublish(res: HttpResponse, req: HttpRequest): Promise<void> {
  let aborted = false;

  try {
    res.onAborted(() => {
      aborted = true;
    });

    const requestId = uuid();

    logger.info('Publishing event', { requestId });

    const publicKey = req.getHeader(`X-Ds-Public-Key`) || req.getHeader(`x-ds-public-key`);
    const signature = req.getHeader(`X-Ds-Req-Signature`) || req.getHeader(`x-ds-req-signature`);

    if (!publicKey || !signature) {
      throw new Error('Public key and signature headers are required');
    }

    const body = await parseBody(res);
    const timestamp = new Date().toISOString();

    const jobData = {
      publicKey,
      signature,
      requestId,
      timestamp,
      body
    };

    if (!aborted) {
      res.cork(() => {
        getJsonResponse(res, '200 ok').end(
          JSON.stringify({
            requestId,
            timestamp
          })
        );
      });
    }
  } catch (err: any) {
    logger.error(`Failed to get room history messages`, { err });

    if (!aborted) {
      res.cork(() => {
        getJsonResponse(res, '500 Internal Server Error').end(
          JSON.stringify({ status: 500, message: err.message })
        );
      });
    }
  }
}
