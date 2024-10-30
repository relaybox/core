import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import { getErrorResponse, getHeaders, getPathParams, getQueryParams } from '@/util/http';
import { TimeoutError } from '@/lib/errors';
import { Pool } from 'pg';

export interface ParsedHttpRequest {
  method: string;
  query: Record<string, string>;
  params: string[];
  headers: Record<string, string>;
  url: string;
}

export type HttpMiddleware = (
  res: HttpResponse,
  req: ParsedHttpRequest,
  next: HttpMiddlewareNext
) => Promise<void> | void;

export type HttpMiddlewareNext = (req?: ParsedHttpRequest) => Promise<void> | void;

export function compose(...middlewares: HttpMiddleware[]) {
  return (res: HttpResponse, req: HttpRequest) => {
    let aborted = false;

    res.onAborted(() => {
      res.cork(() => res.end());
    });

    const method = req.getMethod();
    const query = getQueryParams(req);
    const params = getPathParams(req);
    const headers = getHeaders(req);
    const url = req.getUrl();

    const parsedRequest: ParsedHttpRequest = {
      method,
      query,
      params,
      headers,
      url
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

export function verifyToken(pgPool: Pool | null): HttpMiddleware {
  return async (res: HttpResponse, req: ParsedHttpRequest, next: HttpMiddlewareNext) => {
    console.log('hello');
    next();
  };
}
