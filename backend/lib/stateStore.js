/**
 * Shared ephemeral state for the socket layer.
 *
 * Meeting state (waiting rooms, live transcripts, copilot state) used to live
 * in module-level objects, which meant it vanished on every restart and could
 * never be shared across instances.
 *
 * This exposes a small async interface with two drivers:
 *   - memory: the default, behaviourally identical to what was here before
 *   - redis:  installed at boot when REDIS_URL/REDIS_HOST is configured
 *
 * Redis is strictly optional. If it is not configured, or goes away at
 * runtime, every operation transparently falls back to the memory driver — the
 * app must never fail to boot or serve because a cache is missing.
 */

const now = () => Date.now();

// ─── MEMORY DRIVER ───

const createMemoryDriver = () => {
  const store = new Map(); // key -> { value, expiresAt }

  const read = (key) => {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt < now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  };

  const write = (key, value, ttlSec) => {
    store.set(key, { value, expiresAt: ttlSec ? now() + ttlSec * 1000 : null });
  };

  // Touch the TTL without replacing the value, for collections we append to.
  const bump = (key, ttlSec) => {
    const entry = store.get(key);
    if (entry && ttlSec) entry.expiresAt = now() + ttlSec * 1000;
  };

  return {
    name: 'memory',

    async get(key) {
      const value = read(key);
      return value === undefined ? null : value;
    },
    async set(key, value, ttlSec) {
      write(key, value, ttlSec);
    },
    async del(key) {
      store.delete(key);
    },
    async incrBy(key, n, ttlSec) {
      const next = (read(key) || 0) + n;
      write(key, next, ttlSec);
      return next;
    },

    async listPush(key, ...values) {
      const list = read(key) || [];
      list.push(...values);
      write(key, list);
      return list.length;
    },
    async listRange(key, start = 0, stop = -1) {
      const list = read(key) || [];
      const end = stop < 0 ? list.length + stop + 1 : stop + 1;
      return list.slice(start < 0 ? Math.max(list.length + start, 0) : start, end);
    },
    async listLen(key) {
      return (read(key) || []).length;
    },

    async hset(key, field, value, ttlSec) {
      const hash = read(key) || {};
      hash[field] = value;
      write(key, hash, ttlSec);
    },
    async hget(key, field) {
      const hash = read(key) || {};
      return field in hash ? hash[field] : null;
    },
    async hgetall(key) {
      return { ...(read(key) || {}) };
    },
    async hdel(key, field) {
      const hash = read(key);
      if (hash) delete hash[field];
    },

    async sadd(key, member, ttlSec) {
      const set = read(key) || new Set();
      set.add(String(member));
      write(key, set, ttlSec);
    },
    async sismember(key, member) {
      const set = read(key);
      return set ? set.has(String(member)) : false;
    },
    async smembers(key) {
      const set = read(key);
      return set ? [...set] : [];
    },
    async scard(key) {
      const set = read(key);
      return set ? set.size : 0;
    },

    async acquireLock(key, ttlMs) {
      if (read(key)) return null;
      const token = `${now()}-${Math.random().toString(36).slice(2)}`;
      write(key, token, Math.ceil(ttlMs / 1000));
      return token;
    },
    async releaseLock(key, token) {
      if (read(key) === token) store.delete(key);
    },

    async expire(key, ttlSec) {
      bump(key, ttlSec);
    },
  };
};

// ─── REDIS DRIVER ───

const encode = (value) => JSON.stringify(value);
const decode = (raw) => {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

export const createRedisDriver = (client) => ({
  name: 'redis',

  async get(key) {
    return decode(await client.get(key));
  },
  async set(key, value, ttlSec) {
    if (ttlSec) await client.set(key, encode(value), 'EX', ttlSec);
    else await client.set(key, encode(value));
  },
  async del(key) {
    await client.del(key);
  },
  async incrBy(key, n, ttlSec) {
    const next = await client.incrby(key, n);
    if (ttlSec) await client.expire(key, ttlSec);
    return next;
  },

  async listPush(key, ...values) {
    const len = await client.rpush(key, ...values.map(encode));
    return len;
  },
  async listRange(key, start = 0, stop = -1) {
    return (await client.lrange(key, start, stop)).map(decode);
  },
  async listLen(key) {
    return client.llen(key);
  },

  async hset(key, field, value, ttlSec) {
    await client.hset(key, field, encode(value));
    if (ttlSec) await client.expire(key, ttlSec);
  },
  async hget(key, field) {
    return decode(await client.hget(key, field));
  },
  async hgetall(key) {
    const raw = await client.hgetall(key);
    return Object.fromEntries(Object.entries(raw || {}).map(([k, v]) => [k, decode(v)]));
  },
  async hdel(key, field) {
    await client.hdel(key, field);
  },

  async sadd(key, member, ttlSec) {
    await client.sadd(key, String(member));
    if (ttlSec) await client.expire(key, ttlSec);
  },
  async sismember(key, member) {
    return (await client.sismember(key, String(member))) === 1;
  },
  async smembers(key) {
    return client.smembers(key);
  },
  async scard(key) {
    return client.scard(key);
  },

  async acquireLock(key, ttlMs) {
    const token = `${now()}-${Math.random().toString(36).slice(2)}`;
    const ok = await client.set(key, token, 'PX', ttlMs, 'NX');
    return ok ? token : null;
  },
  async releaseLock(key, token) {
    // Compare-and-delete so we never release a lock another instance now holds.
    await client.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      1,
      key,
      token
    );
  },

  async expire(key, ttlSec) {
    await client.expire(key, ttlSec);
  },
});

// ─── PUBLIC STORE (with fallback) ───

const memoryDriver = createMemoryDriver();
let activeDriver = memoryDriver;

// Circuit breaker: after repeated Redis failures, stop trying for a while
// rather than paying a timeout on every single call.
const FAILURE_THRESHOLD = 5;
const FAILURE_WINDOW_MS = 30_000;
const TRIP_DURATION_MS = 60_000;

let failures = [];
let trippedUntil = 0;

const recordFailure = (op, error) => {
  const ts = now();
  failures = failures.filter((t) => ts - t < FAILURE_WINDOW_MS);
  failures.push(ts);

  if (failures.length === 1) {
    console.error(`[State] Redis op '${op}' failed, serving from memory:`, error.message);
  }

  if (failures.length >= FAILURE_THRESHOLD) {
    trippedUntil = ts + TRIP_DURATION_MS;
    failures = [];
    console.error(`[State] Redis unhealthy — using memory for ${TRIP_DURATION_MS / 1000}s`);
  }
};

const OPERATIONS = [
  'get', 'set', 'del', 'incrBy',
  'listPush', 'listRange', 'listLen',
  'hset', 'hget', 'hgetall', 'hdel',
  'sadd', 'sismember', 'smembers', 'scard',
  'acquireLock', 'releaseLock', 'expire',
];

export const stateStore = Object.fromEntries(
  OPERATIONS.map((op) => [
    op,
    async (...args) => {
      if (activeDriver === memoryDriver || now() < trippedUntil) {
        return memoryDriver[op](...args);
      }
      try {
        return await activeDriver[op](...args);
      } catch (error) {
        recordFailure(op, error);
        return memoryDriver[op](...args);
      }
    },
  ])
);

stateStore.driverName = () => (now() < trippedUntil ? 'memory (redis tripped)' : activeDriver.name);

export const setStateStoreDriver = (driver) => {
  activeDriver = driver || memoryDriver;
  failures = [];
  trippedUntil = 0;
};

export default stateStore;
