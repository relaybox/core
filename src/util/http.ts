import http from 'http';

export const server = http.createServer();

export function openServerConnection({ port }: any) {
  return server.listen(port);
}
