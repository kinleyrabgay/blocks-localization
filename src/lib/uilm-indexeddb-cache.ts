import { Injectable } from '@angular/core';

import { TranslationMap } from './uilm-store';

/** Shape of a single entry persisted in the IndexedDB object store. */
interface IndexedDbCacheEntry {
  /** Composite key: `{prefix}::{lang}` */
  key: string;
  data: TranslationMap;
  /** Unix-epoch ms when this entry was written. */
  timestamp: number;
}

const DB_NAME = 'uilm-translations';
const DB_VERSION = 1;
const STORE_NAME = 'translations';

/**
 * IndexedDB persistence layer for UILM translation cache.
 *
 * Stores translation maps keyed by `{prefix}::{lang}` with timestamps
 * for TTL-based invalidation. Falls back gracefully to `null` when
 * IndexedDB is unavailable (SSR, restrictive incognito, etc.).
 *
 * All public methods are **fire-and-forget safe** — they never throw
 * and resolve to `null` / `void` on any failure.
 *
 * @publicApi
 */
@Injectable({ providedIn: 'root' })
export class UilmIndexedDbCache {
  private dbReady: Promise<IDBDatabase | null>;

  constructor() {
    this.dbReady = this.openDb();
  }

  /** Re-open the database connection (used after unexpected close). */
  private reconnect(): void {
    this.dbReady = this.openDb();
  }

  /**
   * Retrieve a cached entry if it exists and hasn't exceeded the TTL.
   *
   * @param key   Cache key (`{prefix}::{lang}`)
   * @param ttl   Time-to-live in ms. `0` disables expiry (entry is always valid).
   * @returns The translation map, or `null` on miss / expiry / error.
   */
  async get(key: string, ttl: number): Promise<TranslationMap | null> {
    const db = await this.dbReady;
    if (!db) return null;

    try {
      const entry = await this.txGet(db, key);
      if (!entry) return null;
      if (ttl > 0 && Date.now() - entry.timestamp >= ttl) {
        return null;
      }
      return entry.data;
    } catch {
      this.reconnect();
      return null;
    }
  }

  /**
   * Retrieve a stale entry (ignoring TTL) for fallback purposes.
   *
   * @param key Cache key
   * @returns The translation map regardless of age, or `null` if absent.
   */
  async getStale(key: string): Promise<TranslationMap | null> {
    const db = await this.dbReady;
    if (!db) return null;

    try {
      const entry = await this.txGet(db, key);
      return entry?.data ?? null;
    } catch {
      this.reconnect();
      return null;
    }
  }

  /**
   * Persist a translation map.
   *
   * @param key  Cache key
   * @param data Flat key→value translation map
   */
  async set(key: string, data: TranslationMap): Promise<void> {
    const db = await this.dbReady;
    if (!db) return;

    try {
      await this.txPut(db, { key, data, timestamp: Date.now() });
    } catch {
      this.reconnect();
    }
  }

  /** Remove all cached translations from IndexedDB. */
  async clear(): Promise<void> {
    const db = await this.dbReady;
    if (!db) return;

    try {
      await this.txClear(db);
    } catch {
      this.reconnect();
    }
  }

  // ---------------------------------------------------------------------------
  // Private — IndexedDB primitives
  // ---------------------------------------------------------------------------

  private openDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') {
          resolve(null);
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          }
        };

        request.onsuccess = () => {
          const db = request.result;
          // Allow other tabs to upgrade the DB by closing our connection on demand
          db.onversionchange = () => {
            db.close();
            this.reconnect();
          };
          // Reconnect if the browser unexpectedly closes the connection
          db.onclose = () => {
            this.reconnect();
          };
          resolve(db);
        };
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private txGet(db: IDBDatabase, key: string): Promise<IndexedDbCacheEntry | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result as IndexedDbCacheEntry | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  private txPut(db: IDBDatabase, entry: IndexedDbCacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private txClear(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
