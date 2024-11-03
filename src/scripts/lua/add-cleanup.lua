-- Add the new message to the sorted set
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])

-- Remove messages older than cutoff timestamp
local removed = redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[3])

-- If the sorted set is empty after removal, delete the key
local count = redis.call('ZCARD', KEYS[1])
if count == 0 then
    redis.call('DEL', KEYS[1])
end

return removed