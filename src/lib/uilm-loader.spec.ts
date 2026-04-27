import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { vi } from 'vitest';

/** Flush microtask queue (resolved promises). */
const flushMicrotasks = () => new Promise<void>((r) => setTimeout(r, 0));

import { BLOCKS_LOCALIZATION_CONFIG } from './tokens';
import { BlocksLocalizationConfig } from './types';
import { UilmIndexedDbCache } from './uilm-indexeddb-cache';
import { UilmLoader } from './uilm-loader';
import { TranslationMap } from './uilm-store';

const BASE_URL = 'https://api.test.com/uilm/v1';
const PROJECT_KEY = 'test-key';

function createConfig(overrides: Partial<BlocksLocalizationConfig> = {}): BlocksLocalizationConfig {
  return {
    uilmApiBaseUrl: BASE_URL,
    projectKey: PROJECT_KEY,
    availableLangs: ['en', 'de'],
    defaultLang: 'en',
    localeMapping: { en: 'en-US', de: 'de-DE' },
    ...overrides,
  };
}

/** In-memory fake for UilmIndexedDbCache so tests don't need real IndexedDB. */
class FakeIndexedDbCache {
  private store = new Map<string, { data: TranslationMap; timestamp: number }>();

  async get(key: string, ttl: number): Promise<TranslationMap | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (ttl > 0 && Date.now() - entry.timestamp >= ttl) return null;
    return entry.data;
  }

  async getStale(key: string): Promise<TranslationMap | null> {
    return this.store.get(key)?.data ?? null;
  }

  async set(key: string, data: TranslationMap): Promise<void> {
    this.store.set(key, { data, timestamp: Date.now() });
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

describe('UilmLoader', () => {
  let loader: UilmLoader;
  let httpMock: HttpTestingController;
  let fakeIdb: FakeIndexedDbCache;

  function setup(configOverrides: Partial<BlocksLocalizationConfig> = {}) {
    fakeIdb = new FakeIndexedDbCache();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BLOCKS_LOCALIZATION_CONFIG, useValue: createConfig(configOverrides) },
        { provide: UilmIndexedDbCache, useValue: fakeIdb },
      ],
    });
    loader = TestBed.inject(UilmLoader);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    httpMock?.verify();
  });

  // -------------------------------------------------------------------------
  // Basic fetch
  // -------------------------------------------------------------------------
  describe('fetchModuleTranslations — memory-only mode', () => {
    beforeEach(() => setup());

    it('should fetch from API and return translation map', () => {
      const translations = { HELLO: 'Hello', WORLD: 'World' };

      loader.fetchModuleTranslations('en', 'dashboard').subscribe((result) => {
        expect(result).toEqual(translations);
      });

      const req = httpMock.expectOne(
        (r) => r.url.includes('/Key/GetUilmFile') && r.url.includes('ModuleName=dashboard'),
      );
      expect(req.request.headers.get('x-blocks-key')).toBe(PROJECT_KEY);
      req.flush(translations);
    });

    it('should deduplicate concurrent requests for the same module+lang', () => {
      loader.fetchModuleTranslations('en', 'dashboard').subscribe();
      loader.fetchModuleTranslations('en', 'dashboard').subscribe();

      const requests = httpMock.match((r) => r.url.includes('ModuleName=dashboard'));
      expect(requests.length).toBe(1);
      requests[0].flush({ KEY: 'val' });
    });

    it('should return empty map on API + local fallback failure', () => {
      loader.fetchModuleTranslations('en', 'dashboard').subscribe((result) => {
        expect(result).toEqual({});
      });

      httpMock
        .expectOne((r) => r.url.includes('ModuleName=dashboard'))
        .flush(null, { status: 500, statusText: 'Server Error' });

      httpMock
        .expectOne((r) => r.url.includes('assets/i18n/dashboard/en.json'))
        .flush(null, { status: 404, statusText: 'Not Found' });
    });

    it('should fall back to local JSON on API failure', () => {
      loader.fetchModuleTranslations('en', 'dashboard').subscribe((result) => {
        expect(result).toEqual({ 'LABEL.HELLO': 'Hello' });
      });

      httpMock
        .expectOne((r) => r.url.includes('ModuleName=dashboard'))
        .flush(null, { status: 500, statusText: 'Error' });

      httpMock
        .expectOne((r) => r.url.includes('assets/i18n/dashboard/en.json'))
        .flush({ LABEL: { HELLO: 'Hello' } });
    });

    it('should use full locale code in API URL', () => {
      loader.fetchModuleTranslations('en', 'common').subscribe();
      const req = httpMock.expectOne((r) => r.url.includes('Language=en-US'));
      req.flush({});
    });
  });

  // -------------------------------------------------------------------------
  // Key prefixing
  // -------------------------------------------------------------------------
  describe('fetchModuleTranslations — with prefix', () => {
    beforeEach(() => setup({ prefixKeysWithModule: true }));

    it('should prefix keys with module name', () => {
      loader.fetchModuleTranslations('en', 'dashboard').subscribe((result) => {
        expect(result).toEqual({ 'dashboard.HELLO': 'Hello' });
      });

      httpMock.expectOne((r) => r.url.includes('ModuleName=dashboard')).flush({ HELLO: 'Hello' });
    });

    it('should use alias for prefix when provided', () => {
      loader.fetchModuleTranslations('en', 'opportunity', 'op').subscribe((result) => {
        expect(result).toEqual({ 'op.TITLE': 'Title' });
      });

      httpMock.expectOne((r) => r.url.includes('ModuleName=opportunity')).flush({ TITLE: 'Title' });
    });

    it('should not prefix keys when alias is empty string', () => {
      loader.fetchModuleTranslations('en', 'common', '').subscribe((result) => {
        expect(result).toEqual({ KEY: 'val' });
      });

      httpMock.expectOne((r) => r.url.includes('ModuleName=common')).flush({ KEY: 'val' });
    });
  });

  // -------------------------------------------------------------------------
  // L1 cache
  // -------------------------------------------------------------------------
  describe('fetchModuleTranslations — L1 cache', () => {
    beforeEach(() => setup({ cacheTimeout: 60_000 }));

    it('should return cached data on second call within TTL', () => {
      const data = { KEY: 'cached' };

      loader.fetchModuleTranslations('en', 'mod').subscribe();
      httpMock.expectOne((r) => r.url.includes('ModuleName=mod')).flush(data);

      loader.fetchModuleTranslations('en', 'mod').subscribe((result) => {
        expect(result).toEqual(data);
      });

      httpMock.expectNone((r) => r.url.includes('ModuleName=mod'));
    });
  });

  // -------------------------------------------------------------------------
  // IndexedDB mode
  // -------------------------------------------------------------------------
  describe('fetchModuleTranslations — IndexedDB mode', () => {
    beforeEach(() => setup({ cacheStorage: 'indexeddb', cacheTimeout: 60_000 }));

    it('should populate IndexedDB on successful fetch', async () => {
      const data = { KEY: 'idb' };
      let result: TranslationMap | undefined;

      loader.fetchModuleTranslations('en', 'mod').subscribe((r) => (result = r));
      await flushMicrotasks(); // resolve IDB promise (L2 miss)

      httpMock.expectOne((r) => r.url.includes('ModuleName=mod')).flush(data);
      await flushMicrotasks();

      expect(result).toEqual(data);
      const stored = await fakeIdb.get('mod::en', 0);
      expect(stored).toEqual(data);
    });

    it('should serve from IndexedDB when L1 is empty', async () => {
      await fakeIdb.set('mod::en', { KEY: 'from-idb' });
      let result: TranslationMap | undefined;

      loader.fetchModuleTranslations('en', 'mod').subscribe((r) => (result = r));
      await flushMicrotasks(); // resolve IDB promise (L2 hit)

      expect(result).toEqual({ KEY: 'from-idb' });
      httpMock.expectNone((r) => r.url.includes('ModuleName=mod'));
    });

    it('should use stale IndexedDB on API failure when L1 is empty', async () => {
      await fakeIdb.set('mod::en', { KEY: 'stale-idb' });
      // Make it stale by hacking the timestamp
      const entry = (fakeIdb as unknown as { store: Map<string, { timestamp: number }> }).store.get(
        'mod::en',
      )!;
      entry.timestamp = Date.now() - 120_000;

      let result: TranslationMap | undefined;
      loader.fetchModuleTranslations('en', 'mod').subscribe((r) => (result = r));
      await flushMicrotasks(); // resolve IDB promise (L2 expired → falls through to HTTP)

      httpMock
        .expectOne((r) => r.url.includes('ModuleName=mod'))
        .flush(null, { status: 500, statusText: 'Error' });
      await flushMicrotasks(); // resolve stale IDB fallback

      expect(result).toEqual({ KEY: 'stale-idb' });
    });
  });

  // -------------------------------------------------------------------------
  // clearCache
  // -------------------------------------------------------------------------
  describe('clearCache', () => {
    beforeEach(() => setup({ cacheStorage: 'indexeddb', cacheTimeout: 60_000 }));

    it('should clear L1 and L2 caches', async () => {
      await fakeIdb.set('mod::en', { KEY: 'val' });

      loader.clearCache();

      expect(await fakeIdb.get('mod::en', 0)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------
  describe('ensureMetadataLoaded', () => {
    beforeEach(() => setup());

    it('should fetch modules and languages', () => {
      loader.ensureMetadataLoaded().subscribe();

      httpMock
        .expectOne((r) => r.url.includes('/Module/Gets'))
        .flush([
          {
            moduleName: 'dashboard',
            name: null,
            itemId: '1',
            createDate: '',
            lastUpdateDate: '',
            createdBy: null,
            lastUpdatedBy: null,
            tenantId: null,
          },
        ]);

      httpMock
        .expectOne((r) => r.url.includes('/Language/Gets'))
        .flush([
          {
            itemId: '1',
            languageName: 'English',
            languageCode: 'en-US',
            isDefault: true,
            projectKey: null,
          },
        ]);

      expect(loader.getModules().length).toBe(1);
      expect(loader.getLanguages().length).toBe(1);
    });

    it('should no-op after first successful load', () => {
      loader.ensureMetadataLoaded().subscribe();
      httpMock.expectOne((r) => r.url.includes('/Module/Gets')).flush([]);
      httpMock.expectOne((r) => r.url.includes('/Language/Gets')).flush([]);

      loader.ensureMetadataLoaded().subscribe();
      httpMock.expectNone((r) => r.url.includes('/Module/Gets'));
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('fallbackToLocal disabled', () => {
    beforeEach(() => setup({ fallbackToLocal: false }));

    it('should return empty map without trying local file', () => {
      loader.fetchModuleTranslations('en', 'mod').subscribe((result) => {
        expect(result).toEqual({});
      });

      httpMock
        .expectOne((r) => r.url.includes('ModuleName=mod'))
        .flush(null, { status: 500, statusText: 'Error' });

      httpMock.expectNone((r) => r.url.includes('assets/i18n'));
    });
  });

  // -------------------------------------------------------------------------
  // Metadata — cached return + error paths
  // -------------------------------------------------------------------------
  describe('metadata — cached return and error handling', () => {
    beforeEach(() => setup());

    it('should return cached languages on subsequent call', () => {
      // First call — load metadata
      loader.ensureMetadataLoaded().subscribe();
      httpMock
        .expectOne((r) => r.url.includes('/Module/Gets'))
        .flush([
          {
            moduleName: 'mod',
            name: null,
            itemId: '1',
            createDate: '',
            lastUpdateDate: '',
            createdBy: null,
            lastUpdatedBy: null,
            tenantId: null,
          },
        ]);
      httpMock
        .expectOne((r) => r.url.includes('/Language/Gets'))
        .flush([
          {
            itemId: '1',
            languageName: 'English',
            languageCode: 'en-US',
            isDefault: true,
            projectKey: null,
          },
        ]);

      // Second call — should return cached data, no HTTP
      loader.getAvailableLanguages().subscribe((langs) => {
        expect(langs.length).toBe(1);
      });
      loader.getAvailableModules().subscribe((mods) => {
        expect(mods.length).toBe(1);
      });
      httpMock.expectNone((r) => r.url.includes('/Language/Gets'));
      httpMock.expectNone((r) => r.url.includes('/Module/Gets'));
    });

    it('should return empty array and set loaded on languages API error', () => {
      loader.getAvailableLanguages().subscribe((langs) => {
        expect(langs).toEqual([]);
      });
      httpMock
        .expectOne((r) => r.url.includes('/Language/Gets'))
        .flush(null, { status: 500, statusText: 'Error' });

      // After error, languagesLoaded = true, so no retry (but returns empty)
      // Next call will still try because length is 0 AND loaded is true
    });

    it('should return empty array and set loaded on modules API error', () => {
      loader.getAvailableModules().subscribe((mods) => {
        expect(mods).toEqual([]);
      });
      httpMock
        .expectOne((r) => r.url.includes('/Module/Gets'))
        .flush(null, { status: 500, statusText: 'Error' });
    });

    it('should populate locale mapping for new language codes from API', () => {
      // Config has en->en-US and de->de-DE. API returns fr-FR which is NOT in config.
      loader.getAvailableLanguages().subscribe();
      httpMock
        .expectOne((r) => r.url.includes('/Language/Gets'))
        .flush([
          {
            itemId: '2',
            languageName: 'French',
            languageCode: 'fr-FR',
            isDefault: false,
            projectKey: null,
          },
        ]);

      // fr should now be mapped to fr-FR
      loader.fetchModuleTranslations('fr', 'mod').subscribe();
      const req = httpMock.expectOne((r) => r.url.includes('Language=fr-FR'));
      req.flush({});
    });

    it('should not overwrite user-configured locale mapping', () => {
      // Config has en -> en-US. API returns en-GB. Config should win.
      loader.getAvailableLanguages().subscribe();
      httpMock
        .expectOne((r) => r.url.includes('/Language/Gets'))
        .flush([
          {
            itemId: '1',
            languageName: 'English',
            languageCode: 'en-GB',
            isDefault: true,
            projectKey: null,
          },
        ]);

      // Verify by fetching — should use en-US (from config), not en-GB
      loader.fetchModuleTranslations('en', 'mod').subscribe();
      const req = httpMock.expectOne((r) => r.url.includes('Language=en-US'));
      req.flush({});
    });

    it('should deduplicate concurrent ensureMetadataLoaded calls', () => {
      loader.ensureMetadataLoaded().subscribe();
      loader.ensureMetadataLoaded().subscribe();

      // Only one pair of HTTP requests should be made
      const modReqs = httpMock.match((r) => r.url.includes('/Module/Gets'));
      expect(modReqs.length).toBe(1);
      modReqs[0].flush([]);

      const langReqs = httpMock.match((r) => r.url.includes('/Language/Gets'));
      expect(langReqs.length).toBe(1);
      langReqs[0].flush([]);
    });
  });

  // -------------------------------------------------------------------------
  // clearCache — memory-only mode
  // -------------------------------------------------------------------------
  describe('clearCache — memory-only mode', () => {
    beforeEach(() => setup({ cacheTimeout: 60_000 }));

    it('should clear L1 cache so next fetch hits API', () => {
      // Populate L1
      loader.fetchModuleTranslations('en', 'mod').subscribe();
      httpMock.expectOne((r) => r.url.includes('ModuleName=mod')).flush({ KEY: 'val' });

      // Clear
      loader.clearCache();

      // Should hit API again
      loader.fetchModuleTranslations('en', 'mod').subscribe();
      httpMock.expectOne((r) => r.url.includes('ModuleName=mod')).flush({ KEY: 'val2' });
    });
  });

  // -------------------------------------------------------------------------
  // L1 cache with cacheTimeout=0 (no expiry)
  // -------------------------------------------------------------------------
  describe('fetchModuleTranslations — L1 cache with cacheTimeout=0', () => {
    beforeEach(() => setup({ cacheTimeout: 0 }));

    it('should serve from L1 cache with cacheTimeout=0 (no expiry)', () => {
      const data = { KEY: 'cached' };

      loader.fetchModuleTranslations('en', 'mod').subscribe();
      httpMock.expectOne((r) => r.url.includes('ModuleName=mod')).flush(data);

      loader.fetchModuleTranslations('en', 'mod').subscribe((result) => {
        expect(result).toEqual(data);
      });

      httpMock.expectNone((r) => r.url.includes('ModuleName=mod'));
    });
  });

  // -------------------------------------------------------------------------
  // Stale L2 → local fallback path
  // -------------------------------------------------------------------------
  describe('fallback chain — stale L2 miss to local JSON', () => {
    beforeEach(() => setup({ cacheStorage: 'indexeddb', cacheTimeout: 60_000 }));

    it('should fall through to local JSON when stale L2 returns null', async () => {
      // No data in IDB at all
      let result: TranslationMap | undefined;
      loader.fetchModuleTranslations('en', 'mod').subscribe((r) => (result = r));
      await flushMicrotasks(); // IDB miss

      // API fails
      httpMock
        .expectOne((r) => r.url.includes('ModuleName=mod'))
        .flush(null, { status: 500, statusText: 'Error' });
      await flushMicrotasks(); // stale IDB also returns null

      // Should try local JSON
      httpMock
        .expectOne((r) => r.url.includes('assets/i18n/mod/en.json'))
        .flush({ LABEL: { HELLO: 'Local' } });

      expect(result).toEqual({ 'LABEL.HELLO': 'Local' });
    });
  });

  // -------------------------------------------------------------------------
  // Local fallback with empty alias (root path)
  // -------------------------------------------------------------------------
  describe('local fallback — root path for empty alias', () => {
    beforeEach(() => setup({ prefixKeysWithModule: true }));

    it('should use root path for empty-string alias', () => {
      loader.fetchModuleTranslations('en', 'common', '').subscribe();

      // API fails
      httpMock
        .expectOne((r) => r.url.includes('ModuleName=common'))
        .flush(null, { status: 500, statusText: 'Error' });

      // Local fallback should use root path (no module folder)
      const localReq = httpMock.expectOne((r) => r.url === 'assets/i18n/en.json');
      localReq.flush({ KEY: 'val' });
    });
  });

  // -------------------------------------------------------------------------
  // Metadata — ensureMetadataLoaded catchError safety net
  // -------------------------------------------------------------------------
  describe('ensureMetadataLoaded — error propagation', () => {
    beforeEach(() => setup());

    it('should clear inflight and rethrow on unexpected error in metadata pipeline', () => {
      // Monkey-patch getAvailableModules to throw inside the observable
      const origGetModules = loader.getAvailableModules.bind(loader);
      let callCount = 0;
      vi.spyOn(loader, 'getAvailableModules').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Observable((subscriber) => {
            subscriber.error(new Error('unexpected'));
          });
        }
        return origGetModules();
      });

      let caughtError: Error | undefined;
      loader.ensureMetadataLoaded().subscribe({
        error: (err) => {
          caughtError = err;
        },
      });

      expect(caughtError).toBeDefined();
      expect(caughtError?.message).toBe('unexpected');

      // Verify inflight was cleared — second call should not reuse the failed observable
      loader.ensureMetadataLoaded().subscribe();
      httpMock.expectOne((r) => r.url.includes('/Module/Gets')).flush([]);
      httpMock.expectOne((r) => r.url.includes('/Language/Gets')).flush([]);
    });
  });

  describe('accessToken header', () => {
    beforeEach(() => setup({ accessToken: 'my-token' }));

    it('should send Authorization header when configured', () => {
      loader.fetchModuleTranslations('en', 'mod').subscribe();

      const req = httpMock.expectOne((r) => r.url.includes('ModuleName=mod'));
      expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
      req.flush({});
    });
  });
});
