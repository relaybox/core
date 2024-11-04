import { RedisClient } from '@/lib/redis';

const zRateLimiterScript = `
-- Add the current message timestamp to the sorted set
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[1])

-- Remove entries older than the time window
local window_start = ARGV[1] - ARGV[2]
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, window_start)

-- Count remaining messages in the window
local message_count = redis.call('ZCARD', KEYS[1])

-- Check if the rate limit is exceeded
if tonumber(message_count) > tonumber(ARGV[3]) then
  return 0 -- Rate limit exceeded
else
  -- Optionally, set an expiration on the key to clean it up after the window
  redis.call('EXPIRE', KEYS[1], math.ceil(tonumber(ARGV[2]) / 1000))
  return 1 -- Request allowed
end
`;

export async function evaluateRateLimit(
  redisClient: RedisClient,
  key: string,
  evaluationPeriodMs: string,
  entryLimit: string
): Promise<any> {
  const now = Date.now().toString();

  return redisClient.eval(zRateLimiterScript, {
    keys: [key],
    arguments: [now, evaluationPeriodMs, entryLimit]
  });
}
