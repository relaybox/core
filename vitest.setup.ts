// setupTests.ts
import { vi } from 'vitest';
// import { createClient } from 'redis';
// import Redis from 'ioredis';

process.env.REDIS_PORT = '6379';

// const REDIS_HOST = 'localhost';
// const REDIS_PORT = Number(process.env.REDIS_PORT);

// vi.mock('./src/lib/redis', () => {
//   return {
//     connectionOptionsIo: {
//       host: REDIS_HOST,
//       port: REDIS_PORT
//     },
//     getRedisClient: vi.fn().mockImplementation(() => ({
//       connect: vi.fn().mockResolvedValue(undefined),
//       disconnect: vi.fn().mockResolvedValue(undefined),
//       quit: vi.fn().mockResolvedValue(undefined),
//       get: vi.fn().mockResolvedValue(null),
//       set: vi.fn().mockResolvedValue('OK'),
//       del: vi.fn().mockResolvedValue(1),
//       on: vi.fn()
//     }))
//   };
// });

// vi.mock('bullmq', () => {
//   return {
//     Queue: vi.fn().mockImplementation(() => ({
//       add: vi.fn().mockResolvedValue(undefined),
//       close: vi.fn().mockResolvedValue(undefined),
//       on: vi.fn()
//     })),
//     Worker: vi.fn().mockImplementation(() => ({
//       close: vi.fn().mockResolvedValue(undefined),
//       on: vi.fn()
//     }))
//   };
// });
