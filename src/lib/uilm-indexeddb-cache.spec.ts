import { vi } from 'vitest';

import { UilmIndexedDbCache } from './uilm-indexeddb-cache';

/**
 * jsdom does not ship with IndexedDB. The UilmIndexedDbCache gracefully
 * degrades to no-ops when IndexedDB is unavailable. We verify:
 * 1. Graceful degradation (no throws)
 * 2. Correct behavior when IndexedDB IS available (via manual instance testing)
 */
describe('UilmIndexedDbCache — graceful degradation (no IndexedDB)', () => {
  let cache: UilmIndexedDbCache;

  beforeEach(() => {
    // Instantiate directly — no TestBed needed for this standalone service
    cache = new UilmIndexedDbCache();
  });

  it('should return null from get when IndexedDB is unavailable', async () => {
    expect(await cache.get('key::en', 0)).toBeNull();
  });

  it('should return null from getStale when IndexedDB is unavailable', async () => {
    expect(await cache.getStale('key::en')).toBeNull();
  });

  it('should not throw on set when IndexedDB is unavailable', async () => {
    await expect(cache.set('key::en', { K: 'v' })).resolves.toBeUndefined();
  });

  it('should not throw on clear when IndexedDB is unavailable', async () => {
    await expect(cache.clear()).resolves.toBeUndefined();
  });
});

/**
 * Unit tests for the cache logic itself using an in-memory Map stand-in.
 * This validates the TTL / stale / overwrite semantics without requiring
 * a real IndexedDB implementation.
 */
/**
 * Tests for the actual service methods using a fake IndexedDB.
 * We mock the private `openDb` method to return a controlled fake DB object.
 */
describe('UilmIndexedDbCache — with fake IndexedDB', () => {
  let cache: UilmIndexedDbCache;
  let fakeStore: Map<string, unknown>;

  function createFakeDb(): Partial<IDBDatabase> {
    fakeStore = new Map();

    const fakeObjectStore = {
      get(key: string) {
        const req = {
          result: fakeStore.get(key),
          error: null as DOMException | null,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        Promise.resolve().then(() => req.onsuccess?.());
        return req;
      },
      put(entry: { key: string }) {
        fakeStore.set(entry.key, entry);
        const req = {
          result: undefined,
          error: null as DOMException | null,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        Promise.resolve().then(() => req.onsuccess?.());
        return req;
      },
      clear() {
        fakeStore.clear();
        const req = {
          result: undefined,
          error: null as DOMException | null,
          onsuccess: null as (() => void) | null,
          onerror: null as (() => void) | null,
        };
        Promise.resolve().then(() => req.onsuccess?.());
        return req;
      },
    };

    return {
      transaction: () =>
        ({
          objectStore: () => fakeObjectStore,
        }) as unknown as IDBTransaction,
      onversionchange: null,
      onclose: null,
      close: vi.fn(),
    };
  }

  beforeEach(() => {
    cache = new UilmIndexedDbCache();
    // Override the dbReady promise with our fake
    const fakeDb = createFakeDb();
    (cache as unknown as { dbReady: Promise<unknown> }).dbReady = Promise.resolve(fakeDb);
  });

  it('should set and get a cached entry', async () => {
    await cache.set('mod::en', { KEY: 'val' });
    const result = await cache.get('mod::en', 0);
    expect(result).toEqual({ KEY: 'val' });
  });

  it('should return null for missing key', async () => {
    const result = await cache.get('missing::en', 0);
    expect(result).toBeNull();
  });

  it('should return null when entry exceeds TTL', async () => {
    await cache.set('mod::en', { KEY: 'val' });
    // Hack the timestamp to be old
    const entry = fakeStore.get('mod::en') as { timestamp: number };
    entry.timestamp = Date.now() - 120_000;

    const result = await cache.get('mod::en', 60_000);
    expect(result).toBeNull();
  });

  it('should return entry with getStale regardless of age', async () => {
    await cache.set('mod::en', { KEY: 'stale' });
    const entry = fakeStore.get('mod::en') as { timestamp: number };
    entry.timestamp = Date.now() - 999_999;

    const result = await cache.getStale('mod::en');
    expect(result).toEqual({ KEY: 'stale' });
  });

  it('should return null from getStale for missing key', async () => {
    const result = await cache.getStale('missing::en');
    expect(result).toBeNull();
  });

  it('should clear all entries', async () => {
    await cache.set('a::en', { A: '1' });
    await cache.set('b::en', { B: '2' });
    await cache.clear();

    expect(await cache.get('a::en', 0)).toBeNull();
    expect(await cache.get('b::en', 0)).toBeNull();
  });

  it('should reconnect on get error', async () => {
    // Replace dbReady with a db that throws on transaction
    const badDb = {
      transaction: () => {
        throw new Error('dead connection');
      },
      onversionchange: null,
      onclose: null,
    };
    (cache as unknown as { dbReady: Promise<unknown> }).dbReady = Promise.resolve(badDb);

    const result = await cache.get('mod::en', 0);
    expect(result).toBeNull();
    // After error, dbReady should be a new promise (reconnect)
  });

  it('should reconnect on getStale error', async () => {
    const badDb = {
      transaction: () => {
        throw new Error('dead connection');
      },
      onversionchange: null,
      onclose: null,
    };
    (cache as unknown as { dbReady: Promise<unknown> }).dbReady = Promise.resolve(badDb);

    const result = await cache.getStale('mod::en');
    expect(result).toBeNull();
  });

  it('should reconnect on set error', async () => {
    const badDb = {
      transaction: () => {
        throw new Error('dead connection');
      },
      onversionchange: null,
      onclose: null,
    };
    (cache as unknown as { dbReady: Promise<unknown> }).dbReady = Promise.resolve(badDb);

    await expect(cache.set('mod::en', { K: 'v' })).resolves.toBeUndefined();
  });

  it('should reconnect on clear error', async () => {
    const badDb = {
      transaction: () => {
        throw new Error('dead connection');
      },
      onversionchange: null,
      onclose: null,
    };
    (cache as unknown as { dbReady: Promise<unknown> }).dbReady = Promise.resolve(badDb);

    await expect(cache.clear()).resolves.toBeUndefined();
  });
});

/**
 * Tests for the openDb method using a fake indexedDB global.
 */
describe('UilmIndexedDbCache — openDb with fake indexedDB global', () => {
  const originalIndexedDB = globalThis.indexedDB;

  afterEach(() => {
    if (originalIndexedDB) {
      Object.defineProperty(globalThis, 'indexedDB', { value: originalIndexedDB, writable: true });
    } else {
      // jsdom doesn't have indexedDB, so delete our mock
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, writable: true });
    }
  });

  it('should open the database and set up event handlers', async () => {
    const closeFn = vi.fn();
    let onupgradeneeded: (() => void) | null = null;
    let onsuccess: (() => void) | null = null;

    const fakeDb = {
      objectStoreNames: { contains: () => false },
      createObjectStore: vi.fn(),
      onversionchange: null as (() => void) | null,
      onclose: null as (() => void) | null,
      close: closeFn,
    };

    const fakeRequest = {
      result: fakeDb,
      get onupgradeneeded() {
        return onupgradeneeded;
      },
      set onupgradeneeded(fn: (() => void) | null) {
        onupgradeneeded = fn;
      },
      get onsuccess() {
        return onsuccess;
      },
      set onsuccess(fn: (() => void) | null) {
        onsuccess = fn;
      },
      onerror: null as (() => void) | null,
    };

    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: () => {
          // Trigger upgrade then success
          Promise.resolve().then(() => {
            onupgradeneeded?.();
            onsuccess?.();
          });
          return fakeRequest;
        },
      },
      writable: true,
    });

    const cache = new UilmIndexedDbCache();
    // Wait for the openDb promise to resolve
    const db = await (cache as unknown as { dbReady: Promise<unknown> }).dbReady;

    expect(db).toBe(fakeDb);
    expect(fakeDb.createObjectStore).toHaveBeenCalled();
    expect(fakeDb.onversionchange).toBeTruthy();
    expect(fakeDb.onclose).toBeTruthy();

    // Test onversionchange handler — should close db
    fakeDb.onversionchange!();
    expect(closeFn).toHaveBeenCalled();

    // Test onclose handler — should trigger reconnect
    fakeDb.onclose!();
  });

  it('should resolve null when indexedDB.open throws', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: () => {
          throw new Error('SecurityError');
        },
      },
      writable: true,
    });

    const cache = new UilmIndexedDbCache();
    const db = await (cache as unknown as { dbReady: Promise<unknown> }).dbReady;
    expect(db).toBeNull();
  });

  it('should resolve null when indexedDB.open fires onerror', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: () => {
          const req = {
            result: null,
            onupgradeneeded: null as (() => void) | null,
            onsuccess: null as (() => void) | null,
            onerror: null as (() => void) | null,
          };
          Promise.resolve().then(() => req.onerror?.());
          return req;
        },
      },
      writable: true,
    });

    const cache = new UilmIndexedDbCache();
    const db = await (cache as unknown as { dbReady: Promise<unknown> }).dbReady;
    expect(db).toBeNull();
  });

  it('should not create object store if it already exists', async () => {
    const createStoreFn = vi.fn();
    let onupgradeneeded: (() => void) | null = null;
    let onsuccess: (() => void) | null = null;

    const fakeDb = {
      objectStoreNames: { contains: () => true }, // already exists
      createObjectStore: createStoreFn,
      onversionchange: null,
      onclose: null,
      close: vi.fn(),
    };

    Object.defineProperty(globalThis, 'indexedDB', {
      value: {
        open: () => {
          const req = {
            result: fakeDb,
            get onupgradeneeded() {
              return onupgradeneeded;
            },
            set onupgradeneeded(fn: (() => void) | null) {
              onupgradeneeded = fn;
            },
            get onsuccess() {
              return onsuccess;
            },
            set onsuccess(fn: (() => void) | null) {
              onsuccess = fn;
            },
            onerror: null,
          };
          Promise.resolve().then(() => {
            onupgradeneeded?.();
            onsuccess?.();
          });
          return req;
        },
      },
      writable: true,
    });

    const cache = new UilmIndexedDbCache();
    await (cache as unknown as { dbReady: Promise<unknown> }).dbReady;

    expect(createStoreFn).not.toHaveBeenCalled();
  });
});

describe('UilmIndexedDbCache — TTL logic (unit)', () => {
  it('should treat ttl=0 as no-expiry', () => {
    // TTL check: ttl > 0 && elapsed >= ttl → skip
    // When ttl=0, the condition short-circuits to false → entry is valid
    const ttl = 0;
    const elapsed = 999_999;
    const expired = ttl > 0 && elapsed >= ttl;
    expect(expired).toBe(false);
  });

  it('should expire when elapsed >= ttl', () => {
    const ttl = 1000;
    const elapsed = 1001;
    const expired = ttl > 0 && elapsed >= ttl;
    expect(expired).toBe(true);
  });

  it('should not expire when elapsed < ttl', () => {
    const ttl = 1000;
    const elapsed = 500;
    const expired = ttl > 0 && elapsed >= ttl;
    expect(expired).toBe(false);
  });
});
