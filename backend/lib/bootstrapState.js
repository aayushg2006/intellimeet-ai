import { redisConfigured, createRedisClient, connectWithTimeout } from '../config/redis.js';
import { setStateStoreDriver, createRedisDriver } from './stateStore.js';

/**
 * Wire up shared state and cross-instance socket delivery, if Redis is available.
 *
 * This is intentionally impossible to fail: no Redis, unreachable Redis, or a
 * missing adapter package all end in the same place — the in-memory driver,
 * which is exactly how the app behaved before Redis existed. Boot is never
 * delayed by more than the connect timeout.
 */
export const bootstrapState = async (io) => {
  if (!redisConfigured()) {
    console.log('[State] Redis not configured — using in-memory state');
    return { driver: 'memory' };
  }

  const main = createRedisClient('state');
  const pub = createRedisClient('pub');
  const sub = createRedisClient('sub');

  const connections = await Promise.all([
    connectWithTimeout(main),
    connectWithTimeout(pub),
    connectWithTimeout(sub),
  ]);

  if (!connections.every(Boolean)) {
    console.warn('[State] Redis unreachable — falling back to in-memory state');
    for (const client of [main, pub, sub]) client?.disconnect();
    return { driver: 'memory' };
  }

  setStateStoreDriver(createRedisDriver(main));

  try {
    // Dynamic import so a missing optional dependency degrades instead of
    // crashing the process at module-load time.
    const { createAdapter } = await import('@socket.io/redis-adapter');
    io.adapter(createAdapter(pub, sub));
    console.log('[State] Redis connected — shared state and socket adapter active');
    return { driver: 'redis', adapter: true };
  } catch (error) {
    console.warn(`[State] Redis state active, but socket adapter unavailable: ${error.message}`);
    return { driver: 'redis', adapter: false };
  }
};

export default bootstrapState;
