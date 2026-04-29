import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, Observable, of, shareReplay, Subject } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import { BLOCKS_LOCALIZATION_CONFIG } from './tokens';
import { BlocksLocalizationConfig, UilmLanguage, UilmModule } from './types';
import { UilmIndexedDbCache } from './uilm-indexeddb-cache';
import { TranslationMap } from './uilm-store';
import { flattenJson } from './utils/flatten-json';
import { toFullLangCode } from './utils/lang-codes';

/** In-memory cache entry with a write timestamp for TTL checks. */
interface CacheEntry {
  data: TranslationMap;
  timestamp: number;
}

/**
 * Low-level HTTP client for fetching translations from the UILM API.
 *
 * ## Caching architecture (two-tier)
 *
 * | Layer | Storage         | Lifetime        | When enabled              |
 * |-------|-----------------|-----------------|---------------------------|
 * | L1    | In-memory `Map` | Current session | Always                    |
 * | L2    | IndexedDB       | Cross-session   | `cacheStorage: 'indexeddb'`|
 *
 * ### Lookup order
 * 1. **L1 hit** (valid TTL) → return immediately
 * 2. **In-flight dedup** → share existing Observable
 * 3. **L2 hit** (valid TTL, if enabled) → populate L1, return
 * 4. **HTTP fetch** → populate L1 + L2, return
 * 5. **Error fallback chain**: stale L1 → stale L2 → local JSON → empty `{}`
 *
 * @publicApi
 */
@Injectable({ providedIn: 'root' })
export class UilmLoader {
  private readonly http = inject(HttpClient);
  private readonly config = inject<BlocksLocalizationConfig>(BLOCKS_LOCALIZATION_CONFIG);
  private readonly idbCache = inject(UilmIndexedDbCache);
  private readonly destroyRef = inject(DestroyRef);

  /** L1 in-memory cache. */
  private readonly memCache = new Map<string, CacheEntry>();

  /** Tracks in-flight HTTP observables for request deduplication. */
  private readonly inflight = new Map<string, Observable<TranslationMap>>();

  /** Emits when a background revalidation produces updated translations. */
  readonly revalidated$ = new Subject<{ lang: string; data: TranslationMap }>();

  private availableModules: UilmModule[] = [];
  private availableLanguages: UilmLanguage[] = [];
  private shortToFullMapping: Record<string, string> = {};
  private modulesLoaded = false;
  private languagesLoaded = false;
  private metadataInflight$: Observable<void> | null = null;

  constructor() {
    if (this.config.localeMapping) {
      this.shortToFullMapping = { ...this.config.localeMapping };
    }
  }

  // ---------------------------------------------------------------------------
  // Derived config helpers
  // ---------------------------------------------------------------------------

  private get cacheTimeout(): number {
    return this.config.cacheTimeout ?? 0;
  }

  private get shouldPrefixKeys(): boolean {
    return !!this.config.prefixKeysWithModule;
  }

  private get useIndexedDb(): boolean {
    return this.config.cacheStorage === 'indexeddb';
  }

  private get shouldRevalidate(): boolean {
    return this.useIndexedDb && !!this.config.revalidateInBackground;
  }

  private get shouldFallbackToLocal(): boolean {
    return this.config.fallbackToLocal !== false;
  }

  private get localAssetsPath(): string {
    return this.config.localAssetsPath ?? 'assets/i18n';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single UILM module's translations.
   *
   * @param lang       Short language code (e.g. `'en'`)
   * @param moduleName UILM module name as registered in the API
   * @param alias      Optional alias used as the key prefix instead of the module name
   * @returns Observable emitting the (optionally prefixed) key→value map
   */
  fetchModuleTranslations(
    lang: string,
    moduleName: string,
    alias?: string,
  ): Observable<TranslationMap> {
    const prefix = alias ?? moduleName;
    const cacheKey = this.buildCacheKey(prefix, lang);

    // 1. L1 hit
    const l1Entry = this.memCache.get(cacheKey);
    if (l1Entry && this.isL1Valid(cacheKey)) {
      // Still fire background revalidation so stale cached data gets updated
      if (this.shouldRevalidate) {
        this.revalidateFromApi(lang, moduleName, prefix, cacheKey, l1Entry.data);
      }
      return of(l1Entry.data);
    }

    // 2. In-flight dedup
    const existing = this.inflight.get(cacheKey);
    if (existing) return existing;

    // 3. Build the fetch pipeline: L2 → HTTP → fallback
    const request$ = this.resolveTranslation(lang, moduleName, prefix, cacheKey).pipe(
      shareReplay(1),
    );

    this.inflight.set(cacheKey, request$);
    return request$;
  }

  /**
   * Attempt to load translations from IndexedDB cache only (no API, no metadata).
   * Returns `null` if IndexedDB is disabled or the entry is missing.
   * Used for instant store hydration before metadata is available.
   */
  loadFromCacheOnly(
    lang: string,
    moduleName: string,
    alias?: string,
  ): Observable<TranslationMap | null> {
    if (!this.useIndexedDb) return of(null);

    const prefix = alias ?? moduleName;
    const cacheKey = this.buildCacheKey(prefix, lang);

    // L1 hit
    const l1Entry = this.memCache.get(cacheKey);
    if (l1Entry && this.isL1Valid(cacheKey)) {
      return of(l1Entry.data);
    }

    return from(this.idbCache.get(cacheKey, this.cacheTimeout)).pipe(
      map((data) => {
        if (data) {
          this.memCache.set(cacheKey, { data, timestamp: Date.now() });
        }
        return data;
      }),
      catchError(() => of(null)),
    );
  }

  /** Ensure modules and languages metadata are loaded (fetches once, then no-ops). */
  ensureMetadataLoaded(): Observable<void> {
    if (this.modulesLoaded && this.languagesLoaded) {
      return of(undefined);
    }
    if (this.metadataInflight$) return this.metadataInflight$;
    this.metadataInflight$ = this.getAvailableModules().pipe(
      switchMap(() => this.getAvailableLanguages()),
      map(() => undefined),
      tap(() => {
        this.metadataInflight$ = null;
      }),
      catchError((err) => {
        this.metadataInflight$ = null;
        throw err;
      }),
      shareReplay(1),
    );
    return this.metadataInflight$;
  }

  /** Clear all translation caches (L1 in-memory, in-flight, and L2 IndexedDB if enabled). */
  clearCache(): void {
    this.memCache.clear();
    this.inflight.clear();
    if (this.useIndexedDb) {
      this.idbCache.clear();
    }
  }

  /** Fetch available languages from the UILM API. */
  getAvailableLanguages(): Observable<UilmLanguage[]> {
    if (this.languagesLoaded && this.availableLanguages.length > 0) {
      return of(this.availableLanguages);
    }

    const url = `${this.config.uilmApiBaseUrl}/Language/Gets?ProjectKey=${encodeURIComponent(this.config.projectKey)}`;

    return this.http.get<UilmLanguage[]>(url, { headers: this.buildHeaders() }).pipe(
      tap((languages) => {
        this.availableLanguages = languages ?? [];
        for (const lang of this.availableLanguages) {
          const shortCode = lang.languageCode.split('-')[0];
          // Only populate mapping if user config didn't already define this short code
          if (!this.shortToFullMapping[shortCode]) {
            this.shortToFullMapping[shortCode] = lang.languageCode;
          }
        }
        this.languagesLoaded = true;
      }),
      catchError(() => {
        this.languagesLoaded = true;
        return of([]);
      }),
    );
  }

  /** Fetch available modules from the UILM API. */
  getAvailableModules(): Observable<UilmModule[]> {
    if (this.modulesLoaded && this.availableModules.length > 0) {
      return of(this.availableModules);
    }

    const url = `${this.config.uilmApiBaseUrl}/Module/Gets?ProjectKey=${encodeURIComponent(this.config.projectKey)}`;

    return this.http.get<UilmModule[]>(url, { headers: this.buildHeaders() }).pipe(
      tap((modules) => {
        this.availableModules = modules ?? [];
        this.modulesLoaded = true;
      }),
      catchError(() => {
        this.modulesLoaded = true;
        return of([]);
      }),
    );
  }

  /** Get cached languages (empty until `ensureMetadataLoaded()` resolves). */
  getLanguages(): UilmLanguage[] {
    return this.availableLanguages;
  }

  /** Get cached modules (empty until `ensureMetadataLoaded()` resolves). */
  getModules(): UilmModule[] {
    return this.availableModules;
  }

  // ---------------------------------------------------------------------------
  // Private — cache helpers
  // ---------------------------------------------------------------------------

  private buildCacheKey(prefix: string, lang: string): string {
    return `${prefix}::${lang}`;
  }

  /** Check whether the L1 entry is present and within TTL. `cacheTimeout=0` means no expiry. */
  private isL1Valid(key: string): boolean {
    const entry = this.memCache.get(key);
    if (!entry) return false;
    if (this.cacheTimeout <= 0) return true; // 0 = no expiry, entry is always valid
    return Date.now() - entry.timestamp < this.cacheTimeout;
  }

  /** Write data to L1 (always) and L2 (when enabled). */
  private populateCache(key: string, data: TranslationMap): void {
    this.memCache.set(key, { data, timestamp: Date.now() });
    if (this.useIndexedDb) {
      // Fire-and-forget — IndexedDB write is best-effort
      this.idbCache.set(key, data);
    }
  }

  // ---------------------------------------------------------------------------
  // Private — fetch pipeline
  // ---------------------------------------------------------------------------

  /**
   * Resolve translations through the full L2 → HTTP → fallback chain.
   * Called only when L1 misses and no in-flight request exists.
   */
  private resolveTranslation(
    lang: string,
    moduleName: string,
    prefix: string,
    cacheKey: string,
  ): Observable<TranslationMap> {
    if (this.useIndexedDb) {
      return from(this.idbCache.get(cacheKey, this.cacheTimeout)).pipe(
        switchMap((idbData) => {
          if (idbData) {
            this.memCache.set(cacheKey, { data: idbData, timestamp: Date.now() });
            this.inflight.delete(cacheKey);

            if (this.shouldRevalidate) {
              this.revalidateFromApi(lang, moduleName, prefix, cacheKey, idbData);
            }

            return of(idbData);
          }
          return this.fetchFromApi(lang, moduleName, prefix, cacheKey);
        }),
      );
    }
    return this.fetchFromApi(lang, moduleName, prefix, cacheKey);
  }

  /** Issue the HTTP request and handle success / error with full fallback chain. */
  private fetchFromApi(
    lang: string,
    moduleName: string,
    prefix: string,
    cacheKey: string,
  ): Observable<TranslationMap> {
    const fullLangCode = toFullLangCode(lang, this.shortToFullMapping);
    const url =
      `${this.config.uilmApiBaseUrl}/Key/GetUilmFile` +
      `?ProjectKey=${this.config.projectKey}` +
      `&ModuleName=${encodeURIComponent(moduleName)}` +
      `&Language=${encodeURIComponent(fullLangCode)}`;

    return this.http.get<TranslationMap>(url, { headers: this.buildHeaders() }).pipe(
      map((data) => this.sanitizeApiResponse(data)),
      map((data) => (this.shouldPrefixKeys ? this.prefixKeys(data, prefix) : data)),
      tap((data) => {
        this.populateCache(cacheKey, data);
        this.inflight.delete(cacheKey);
      }),
      catchError(() => {
        this.inflight.delete(cacheKey);
        return this.resolveFromFallbacks(lang, moduleName, prefix, cacheKey);
      }),
    );
  }

  /**
   * Fallback chain on HTTP failure:
   * 1. Stale L1 (in-memory)
   * 2. Stale L2 (IndexedDB, if enabled)
   * 3. Local JSON file (if enabled)
   * 4. Empty map
   */
  private resolveFromFallbacks(
    lang: string,
    moduleName: string,
    prefix: string,
    cacheKey: string,
  ): Observable<TranslationMap> {
    // 1. Stale L1
    const staleL1 = this.memCache.get(cacheKey);
    if (staleL1) return of(staleL1.data);

    // 2. Stale L2
    if (this.useIndexedDb) {
      return from(this.idbCache.getStale(cacheKey)).pipe(
        switchMap((staleIdb) => {
          if (staleIdb) return of(staleIdb);
          return this.localFallbackOrEmpty(lang, moduleName, prefix);
        }),
      );
    }

    // 3 + 4. Local JSON or empty
    return this.localFallbackOrEmpty(lang, moduleName, prefix);
  }

  /** Attempt local JSON fallback, or return empty map. */
  private localFallbackOrEmpty(
    lang: string,
    moduleName: string,
    prefix: string,
  ): Observable<TranslationMap> {
    if (this.shouldFallbackToLocal) {
      return this.fetchLocalFallback(lang, moduleName, prefix);
    }
    return of({} as TranslationMap);
  }

  // ---------------------------------------------------------------------------
  // Private — local fallback
  // ---------------------------------------------------------------------------

  /**
   * Fetch translations from a local JSON file.
   * Nested JSON is automatically flattened to dot-notation keys.
   *
   * Path convention:
   * - Module with content: `{localAssetsPath}/{moduleName}/{lang}.json`
   * - Root/common module (empty alias): `{localAssetsPath}/{lang}.json`
   */
  private fetchLocalFallback(
    lang: string,
    moduleName: string,
    prefix: string,
  ): Observable<TranslationMap> {
    const path =
      prefix === ''
        ? `${this.localAssetsPath}/${lang}.json`
        : `${this.localAssetsPath}/${moduleName}/${lang}.json`;

    return this.http.get<Record<string, unknown>>(path).pipe(
      map((nested) => {
        const flat = flattenJson(nested);
        return this.shouldPrefixKeys ? this.prefixKeys(flat, prefix) : flat;
      }),
      tap((data) => this.populateCache(this.buildCacheKey(prefix, lang), data)),
      catchError(() => of({} as TranslationMap)),
    );
  }

  // ---------------------------------------------------------------------------
  // Private — background revalidation
  // ---------------------------------------------------------------------------

  /**
   * Fire-and-forget API fetch that silently updates caches and emits on
   * `revalidated$` when the response differs from the currently cached data.
   */
  private revalidateFromApi(
    lang: string,
    moduleName: string,
    prefix: string,
    cacheKey: string,
    cachedData: TranslationMap,
  ): void {
    const fullLangCode = toFullLangCode(lang, this.shortToFullMapping);
    const url =
      `${this.config.uilmApiBaseUrl}/Key/GetUilmFile` +
      `?ProjectKey=${this.config.projectKey}` +
      `&ModuleName=${encodeURIComponent(moduleName)}` +
      `&Language=${encodeURIComponent(fullLangCode)}`;

    this.http
      .get<TranslationMap>(url, { headers: this.buildHeaders() })
      .pipe(
        map((data) => this.sanitizeApiResponse(data)),
        map((data) => (this.shouldPrefixKeys ? this.prefixKeys(data, prefix) : data)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (freshData) => {
          if (!this.shallowEqual(freshData, cachedData)) {
            this.populateCache(cacheKey, freshData);
            this.revalidated$.next({ lang, data: freshData });
          }
        },
        error: () => {
          /* silent — cached data is already served */
        },
      });
  }

  // ---------------------------------------------------------------------------
  // Private — utilities
  // ---------------------------------------------------------------------------

  private buildHeaders(): HttpHeaders {
    const headers: Record<string, string> = {
      'x-blocks-key': this.config.projectKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    }
    return new HttpHeaders(headers);
  }

  /** Ensure API response is a valid flat object. Returns empty map for malformed responses. */
  private sanitizeApiResponse(data: unknown): TranslationMap {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {};
    }
    return data as TranslationMap;
  }

  /** Shallow key-by-key equality check for flat TranslationMaps. */
  private shallowEqual(a: TranslationMap, b: TranslationMap): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) => a[key] === b[key]);
  }

  private prefixKeys(data: TranslationMap, prefix: string): TranslationMap {
    if (!prefix) return data;
    const prefixed: TranslationMap = {};
    const lowerPrefix = prefix.toLowerCase();
    for (const [key, value] of Object.entries(data)) {
      prefixed[`${lowerPrefix}.${key}`] = value;
    }
    return prefixed;
  }
}
