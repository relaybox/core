import { RedisClient } from '@/lib/redis';

// const rateLimiterScript = `
//   local current
//   current = redis.call('INCRBY', KEYS[1], ARGV[1])
//   if current == tonumber(ARGV[1]) then
//     redis.call('EXPIRE', KEYS[1], ARGV[2])
//   end
//   return current or 0
// `;

export async function incRateLimitCount(
  redisClient: RedisClient,
  key: string,
  ttlSecs: number
): Promise<any> {
  const current = await redisClient.incrBy(key, 1);

  if (current === 1) {
    await redisClient.expire(key, ttlSecs, 'NX');
  }

  return current;

  // return redisClient.eval(rateLimiterScript, {
  //   keys: [key],
  //   arguments: ['1', ttlMs]
  // });
}
