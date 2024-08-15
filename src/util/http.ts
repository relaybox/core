import { HttpResponse } from 'uWebSockets.js';

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
