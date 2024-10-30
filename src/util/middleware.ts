import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import {
  getErrorResponse,
  getHeaders,
  getPathParams,
  getQueryParams,
  parseRequestBody
} from '@/util/http';
import { Pool } from 'pg';
import { Logger } from 'winston';
import { getSecretKey } from '@/modules/auth/auth.service';

export interface ParsedHttpRequest {
  method: string;
  query: Record<string, string>;
  params: string[];
  headers: Record<string, string>;
  url: string;
  body: any;
}

export type HttpMiddleware = (
  res: HttpResponse,
  req: ParsedHttpRequest,
  next: HttpMiddlewareNext
) => Promise<void> | void;

export type HttpRequestHandler = (res: HttpResponse, req: HttpRequest) => Promise<void>;

export type HttpMiddlewareNext = (req?: ParsedHttpRequest) => Promise<void> | void;

export function compose(...middlewares: HttpMiddleware[]): HttpRequestHandler {
  return async (res: HttpResponse, req: HttpRequest) => {
    let aborted = false;

    res.onAborted(() => {
      res.cork(() => res.end());
    });

    // Capture all necessary request data (like headers) before introducing any async code.
    // Reference: https://github.com/uNetworking/uWebSockets.js/discussions/84

    const method = req.getMethod();
    const query = getQueryParams(req);
    const params = getPathParams(req);
    const headers = getHeaders(req);
    const url = req.getUrl();
    const body = await parseRequestBody(res);

    const parsedRequest: ParsedHttpRequest = {
      method,
      query,
      params,
      headers,
      url,
      body
    };

    const dispatch = async (i: number, currentRequest: ParsedHttpRequest) => {
      if (aborted) {
        return;
      }

      const nextMiddleware = middlewares[i];

      const { promise: timeoutPromise, clearRequestTimeout } = timeoutRace(5000);

      try {
        await Promise.race([
          timeoutPromise,
          nextMiddleware(res, currentRequest, (nextRequest?: ParsedHttpRequest) =>
            dispatch(i + 1, nextRequest || currentRequest)
          )
        ]);

        clearRequestTimeout();
        return;
      } catch (err: unknown) {
        aborted = true;
        res.cork(() => getErrorResponse(res, err));
        return;
      }
    };

    dispatch(0, parsedRequest);
  };
}

function timeoutRace(duration = 500) {
  let timeoutId: NodeJS.Timeout;

  const promise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Timeout occurred'));
    }, duration);
  });

  return {
    promise,
    clearRequestTimeout: () => clearTimeout(timeoutId)
  };
}

export async function middlewareOne(
  res: HttpResponse,
  req: ParsedHttpRequest,
  next: HttpMiddlewareNext
) {
  // await new Promise((resolve) => setTimeout(resolve, 500));
  next();
}

export function requestLogger(
  res: HttpResponse,
  req: ParsedHttpRequest,
  next: HttpMiddlewareNext
): void {
  console.log(req.url);

  // throw new Error('test');

  next();
}

// export function verifyToken(logger: Logger, pgPool: Pool | null): HttpMiddleware {
//   return async (res: HttpResponse, req: ParsedHttpRequest, next: HttpMiddlewareNext) => {
//     if (!pgPool) {
//       throw new Error('Postgres pool not initialized');
//     }

//     const pgClient = await pgPool.connect();

//     try {
//       const secretKey = await getSecretKey(logger, pgClient, appPid, keyId);
//       next();
//     } catch (err: unknown) {
//       logger.error(`Failed to verify token`, { err });
//       res.cork(() => getErrorResponse(res, err));
//     } finally {
//       if (pgClient) {
//         pgClient.release();
//       }
//     }
//   };
// }
