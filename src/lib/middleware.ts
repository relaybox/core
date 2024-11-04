import { HttpRequest, HttpResponse } from 'uWebSockets.js';
import {
  getErrorResponse,
  getHeaders,
  getPathParams,
  getQueryParams,
  parseRequestBody
} from '@/util/http';

const DEFAULT_MIDDLEWARE_TIMEOUT_MS = 5000;

export interface ParsedHttpRequest {
  method: string;
  query: Record<string, string>;
  params: string[];
  headers: Record<string, string>;
  url: string;
  body: any;
  [key: string]: any;
}

export type HttpMiddleware = (
  res: HttpResponse,
  req: ParsedHttpRequest,
  next: HttpMiddlewareNext
) => Promise<void> | void;

export type HttpRequestHandler = (res: HttpResponse, req: HttpRequest) => Promise<void>;
export type HttpMiddlewareNext = (extendRequest?: Record<string, any>) => Promise<void> | void;

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

    async function dispatch(i: number, currentRequest: ParsedHttpRequest) {
      if (aborted) {
        return;
      }

      const nextMiddleware = middlewares[i];

      const { promise: timeoutPromise, clearRequestTimeout } = getMiddlewareTimeout(
        DEFAULT_MIDDLEWARE_TIMEOUT_MS
      );

      try {
        await Promise.race([
          timeoutPromise,
          nextMiddleware(res, currentRequest, (nextRequest?: Record<string, any>) =>
            dispatch(i + 1, {
              ...currentRequest,
              ...(nextRequest || {})
            })
          )
        ]);

        return;
      } catch (err: unknown) {
        aborted = true;
        res.cork(() => getErrorResponse(res, err));
        return;
      } finally {
        clearRequestTimeout();
      }
    }

    dispatch(0, parsedRequest);
  };
}

function getMiddlewareTimeout(duration = 500) {
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
