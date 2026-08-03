import Redis from 'ioredis';

/**
 * Redis is entirely optional.
 *
 * The previous version constructed an eager client defaulting to
 * 127.0.0.1:6379, so on a host without Redis (which is the deployed case)
 * ioredis retried forever and filled the logs with ECONNREFUSED — while
 * nothing actually used the client.
 *
 * Now: no configuration means no client, and the state store quietly stays on
 * its in-memory driver.
 */

export const redisConfigured = () => Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

export const createRedisClient = (label = 'main') => {
  if (!redisConfigured()) return null;

  const options = {
    // Connect explicitly, so a bad host can't stall module import.
    lazyConnect: true,
    // Fail fast rather than hanging a request while disconnected.
    maxRetriesPerRequest: 1,
    // Critical: without this ioredis buffers commands while down, so
    // `await stateStore.get()` would hang instead of falling back to memory.
    enableOfflineQueue: false,
    connectTimeout: 4000,
    retryStrategy: (times) => (times > 10 ? null : Math.min(times * 200, 3000)),
  };

  const client = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, options)
    : new Redis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
        ...options,
      });

  client.on('error', (err) => {
    // The state store's circuit breaker handles the functional side of this;
    // the log line is only so an operator can see what is wrong.
    console.error(`[Redis:${label}] ${err.message}`);
  });

  return client;
};

export const connectWithTimeout = async (client, ms = 4000) => {
  if (!client) return false;

  try {
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), ms)),
    ]);
    return true;
  } catch (error) {
    console.warn(`[Redis] Connection failed: ${error.message}`);
    return false;
  }
};

export default { redisConfigured, createRedisClient, connectWithTimeout };
