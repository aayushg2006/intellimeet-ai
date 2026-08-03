import { stateStore, setStateStoreDriver, createRedisDriver } from '../lib/stateStore.js';

describe('stateStore (memory driver)', () => {
  beforeEach(() => setStateStoreDriver(null));

  it('round-trips values and reports null for missing keys', async () => {
    await stateStore.set('a', { x: 1 });
    expect(await stateStore.get('a')).toEqual({ x: 1 });
    expect(await stateStore.get('missing')).toBeNull();
  });

  it('expires keys once their TTL has passed', async () => {
    await stateStore.set('temp', 'value', 0.01); // 10ms
    expect(await stateStore.get('temp')).toBe('value');
    await new Promise((r) => setTimeout(r, 25));
    expect(await stateStore.get('temp')).toBeNull();
  });

  it('supports list append and negative-index ranges', async () => {
    await stateStore.listPush('lines', 'one', 'two');
    await stateStore.listPush('lines', 'three');

    expect(await stateStore.listLen('lines')).toBe(3);
    expect(await stateStore.listRange('lines')).toEqual(['one', 'two', 'three']);
    // The copilot reads a trailing window this way.
    expect(await stateStore.listRange('lines', -2)).toEqual(['two', 'three']);
  });

  it('supports hash and set operations', async () => {
    await stateStore.hset('waiting', 'sock1', { name: 'Guest' });
    expect(await stateStore.hget('waiting', 'sock1')).toEqual({ name: 'Guest' });
    expect(await stateStore.hgetall('waiting')).toEqual({ sock1: { name: 'Guest' } });

    await stateStore.hdel('waiting', 'sock1');
    expect(await stateStore.hgetall('waiting')).toEqual({});

    await stateStore.sadd('seen', 'hash1');
    expect(await stateStore.sismember('seen', 'hash1')).toBe(true);
    expect(await stateStore.sismember('seen', 'nope')).toBe(false);
  });

  it('grants a lock once and refuses it until released', async () => {
    const token = await stateStore.acquireLock('job', 1000);
    expect(token).toBeTruthy();
    expect(await stateStore.acquireLock('job', 1000)).toBeNull();

    await stateStore.releaseLock('job', token);
    expect(await stateStore.acquireLock('job', 1000)).toBeTruthy();
  });

  it('does not release a lock when the token does not match', async () => {
    const token = await stateStore.acquireLock('job2', 1000);
    await stateStore.releaseLock('job2', 'someone-elses-token');
    // Still held by the original owner.
    expect(await stateStore.acquireLock('job2', 1000)).toBeNull();
    await stateStore.releaseLock('job2', token);
  });
});

describe('stateStore fallback behaviour', () => {
  afterEach(() => setStateStoreDriver(null));

  it('falls back to memory when the active driver throws', async () => {
    const brokenClient = {
      get: async () => { throw new Error('ECONNREFUSED'); },
      set: async () => { throw new Error('ECONNREFUSED'); },
    };
    setStateStoreDriver(createRedisDriver(brokenClient));

    // Neither call throws; both are transparently served from memory.
    await expect(stateStore.set('k', 'v')).resolves.not.toThrow();
    await expect(stateStore.get('k')).resolves.toBe('v');
  });
});
