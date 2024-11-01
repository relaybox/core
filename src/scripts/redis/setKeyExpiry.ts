import { defineScript } from 'redis';

export const setKeyExpiry = defineScript({
  NUMBER_OF_KEYS: 1,
  SCRIPT: `        
    if redis.call("TTL", KEYS[1]) == -1 then
      return redis.call("EXPIRE", KEYS[1], ARGV[1])
    else
      return 0  -- Indicates that the key already has an expiry
    end
  `,
  transformArguments(key, expiry) {
    return [key, expiry.toString()];
  }
});
