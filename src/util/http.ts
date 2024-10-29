import { BadRequestError } from '@/lib/errors';
import { HttpRequest, HttpResponse } from 'uWebSockets.js';

interface ErrorResponseBody {
  statusCode: number;
  name: string;
  message?: string;
}

export interface ParsedHttpRequest {
  method: string;
  query: Record<string, string>;
  params: string[];
}

export type HttpHandler = (res: HttpResponse, req: ParsedHttpRequest) => void | Promise<void>;

export type HttpMiddleware = (handler: HttpHandler) => HttpHandler;

export function compose(middlewares: HttpMiddleware[], handler: HttpHandler): HttpHandler {
  return middlewares.reduceRight((next, middleware) => middleware(next), handler);
}

export function getJsonResponse(res: HttpResponse, status: string) {
  res.writeStatus(status);
  res.writeHeader('Content-Type', 'application/json');
  res.writeHeader('Access-Control-Allow-Origin', '*');

  return res;
}

export function getCorsResponse(res: HttpResponse) {
  res.writeHeader('Access-Control-Allow-Origin', '*');
  res.writeHeader('Access-Control-Allow-Headers', 'Content-Type');

  return res;
}

export function parseRequestBody(res: HttpResponse): any {
  return new Promise<string>((resolve) => {
    let buffer: Buffer;

    res.onData((chunk, isLast) => {
      const currentBuffer = Buffer.from(chunk);

      buffer = buffer
        ? Buffer.concat([buffer, currentBuffer])
        : isLast
        ? currentBuffer
        : Buffer.concat([currentBuffer]);

      if (isLast) {
        resolve(buffer.toString());
      }
    });
  });
}

export function getHeader(req: HttpRequest, key: string): string | undefined {
  return req.getHeader(key) || req.getHeader(key.toLowerCase());
}

export function getSuccessResponse(res: HttpResponse, body?: any): HttpResponse {
  return getJsonResponse(res, '200 OK').end(JSON.stringify(body));
}

export function getErrorResponse(res: HttpResponse, err: unknown): HttpResponse {
  if (err instanceof BadRequestError) {
    return getJsonResponse(res, '400 Bad Request').end(
      JSON.stringify(formatErrorResponseBody(400, err))
    );
  }

  return getJsonResponse(res, '500 Bad Request').end();
}

export function formatErrorResponseBody(statusCode: number, err: unknown): ErrorResponseBody {
  if (err instanceof Error) {
    return {
      statusCode,
      name: err.name,
      message: err.message
    };
  }

  return {
    statusCode: 500,
    name: 'InternalServerError'
  };
}

export function getQueryParams(req: HttpRequest): Record<string, string> {
  const query = req.getQuery();

  const params: Record<string, string> = {};

  query.split('&').forEach((param) => {
    const [key, value] = param.split('=');

    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  });

  return params;
}

export function getPathParams(req: HttpRequest): string[] {
  const params: string[] = [];
  let index = 0;

  while (true) {
    const param = req.getParameter(index++);

    if (!param) {
      break;
    }

    params.push(param);
  }

  return params;
}

export function sessionTokenGuard(handler: Function) {
  return (res: HttpResponse, req: HttpRequest) => {
    let aborted = false;

    res.onAborted(() => {
      aborted = true;
    });

    const method = req.getMethod();
    const query = getQueryParams(req);
    const params = getPathParams(req);

    const parsedRequest: ParsedHttpRequest = {
      method,
      query,
      params
    };

    return handler(res, parsedRequest);
  };
}

// export const sessionTokenGuard = (next: any) => (res: HttpResponse, req: HttpRequest) => {
//   return (res: HttpResponse, req: HttpRequest) => {
//     let aborted = false;

//     res.onAborted(() => {
//       aborted = true;
//     });

//     const method = req.getMethod();
//     const query = getQueryParams(req);
//     const params = getPathParams(req);

//     const parsedRequest: ParsedHttpRequest = {
//       method,
//       query,
//       params
//     };

//     next(res, parsedRequest);
//   };
// };

export function requestPipe(middlewares: any[], handler: Function) {}
