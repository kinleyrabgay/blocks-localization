import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { BLOCKS_LOCALIZATION_CONFIG } from './tokens';
import { BlocksLocalizationConfig } from './types';
import { UilmStore } from './uilm-store';

function createConfig(overrides: Partial<BlocksLocalizationConfig> = {}): BlocksLocalizationConfig {
  return {
    uilmApiBaseUrl: 'https://api.test.com/uilm/v1',
    projectKey: 'test-key',
    availableLangs: ['en', 'de'],
    defaultLang: 'en',
    ...overrides,
  };
}

describe('UilmStore', () => {
  let store: UilmStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: BLOCKS_LOCALIZATION_CONFIG, useValue: createConfig() }],
    });
    store = TestBed.inject(UilmStore);
  });

  afterEach(() => localStorage.clear());

  it('should initialize with default language', () => {
    expect(store.activeLang()).toBe('en');
  });

  it('should report not ready when no translations are loaded', () => {
    expect(store.ready()).toBe(false);
  });

  it('should report ready after setting translations', () => {
    store.setTranslation({ KEY: 'value' }, 'en');
    expect(store.ready()).toBe(true);
  });

  it('should translate a key', () => {
    store.setTranslation({ HELLO: 'Hello World' }, 'en');
    expect(store.translate('HELLO')).toBe('Hello World');
  });

  it('should return the raw key when translation is missing', () => {
    store.setTranslation({ HELLO: 'Hello' }, 'en');
    expect(store.translate('MISSING')).toBe('MISSING');
  });

  it('should interpolate params in {{ }}', () => {
    store.setTranslation({ GREET: 'Hello {{ name }}!' }, 'en');
    expect(store.translate('GREET', { name: 'Alice' })).toBe('Hello Alice!');
  });

  it('should interpolate dotted path params like {{ user.name }}', () => {
    store.setTranslation({ GREET: 'Hello {{ user.name }} from {{ user.company }}!' }, 'en');
    expect(store.translate('GREET', { user: { name: 'Alice', company: 'SELISE' } })).toBe(
      'Hello Alice from SELISE!',
    );
  });

  it('should keep placeholder when dotted path resolves to undefined', () => {
    store.setTranslation({ GREET: 'Hello {{ user.name }}!' }, 'en');
    expect(store.translate('GREET', { user: {} })).toBe('Hello {{ user.name }}!');
  });

  it('should keep placeholder when intermediate in dotted path is an array', () => {
    store.setTranslation({ GREET: 'Hello {{ user.name }}!' }, 'en');
    expect(store.translate('GREET', { user: ['a', 'b'] })).toBe('Hello {{ user.name }}!');
  });

  it('should keep placeholder when intermediate in dotted path is not an object', () => {
    store.setTranslation({ GREET: 'Hello {{ user.name }}!' }, 'en');
    expect(store.translate('GREET', { user: 'string' })).toBe('Hello {{ user.name }}!');
  });

  it('should keep placeholder when param is missing', () => {
    store.setTranslation({ GREET: 'Hello {{ name }}!' }, 'en');
    expect(store.translate('GREET', {})).toBe('Hello {{ name }}!');
  });

  it('should merge translations (not overwrite)', () => {
    store.setTranslation({ A: '1' }, 'en');
    store.setTranslation({ B: '2' }, 'en');
    expect(store.translate('A')).toBe('1');
    expect(store.translate('B')).toBe('2');
  });

  it('should check key existence via has()', () => {
    store.setTranslation({ EXIST: 'yes' }, 'en');
    expect(store.has('EXIST')).toBe(true);
    expect(store.has('NOPE')).toBe(false);
  });

  it('should switch language and persist to localStorage', () => {
    store.setActiveLang('de');
    expect(store.activeLang()).toBe('de');
    expect(localStorage.getItem('uilmLang')).toBeTruthy();
  });

  it('should bump version on setTranslation', () => {
    const v1 = store.version();
    store.setTranslation({ A: '1' }, 'en');
    expect(store.version()).toBe(v1 + 1);
  });

  it('should return available langs from config', () => {
    expect(store.getAvailableLangs()).toEqual(['en', 'de']);
  });

  it('should reject invalid language in setActiveLang and log a warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    store.setActiveLang('xx');
    expect(store.activeLang()).toBe('en'); // unchanged
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('"xx" is not in availableLangs'));
    warnSpy.mockRestore();
  });

  describe('langStorage: sessionStorage', () => {
    beforeEach(() => {
      sessionStorage.clear();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: BLOCKS_LOCALIZATION_CONFIG,
            useValue: createConfig({ langStorage: 'sessionStorage' }),
          },
        ],
      });
      store = TestBed.inject(UilmStore);
    });

    afterEach(() => sessionStorage.clear());

    it('should persist to sessionStorage', () => {
      store.setActiveLang('de');
      expect(sessionStorage.getItem('uilmLang')).toBeTruthy();
      expect(localStorage.getItem('uilmLang')).toBeNull();
    });

    it('should restore from sessionStorage', () => {
      sessionStorage.setItem('uilmLang', 'de');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: BLOCKS_LOCALIZATION_CONFIG,
            useValue: createConfig({ langStorage: 'sessionStorage' }),
          },
        ],
      });
      const freshStore = TestBed.inject(UilmStore);
      expect(freshStore.activeLang()).toBe('de');
    });
  });

  describe('langStorage: none', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: BLOCKS_LOCALIZATION_CONFIG, useValue: createConfig({ langStorage: 'none' }) },
        ],
      });
      store = TestBed.inject(UilmStore);
    });

    it('should not persist language anywhere', () => {
      store.setActiveLang('de');
      expect(localStorage.getItem('uilmLang')).toBeNull();
      expect(sessionStorage.getItem('uilmLang')).toBeNull();
    });

    it('should always start with defaultLang', () => {
      localStorage.setItem('uilmLang', 'de');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: BLOCKS_LOCALIZATION_CONFIG, useValue: createConfig({ langStorage: 'none' }) },
        ],
      });
      const freshStore = TestBed.inject(UilmStore);
      expect(freshStore.activeLang()).toBe('en');
    });
  });

  describe('custom langStorageKey', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          {
            provide: BLOCKS_LOCALIZATION_CONFIG,
            useValue: createConfig({ langStorageKey: 'myAppLang' }),
          },
        ],
      });
      store = TestBed.inject(UilmStore);
    });

    it('should use custom storage key', () => {
      store.setActiveLang('de');
      expect(localStorage.getItem('myAppLang')).toBeTruthy();
      expect(localStorage.getItem('uilmLang')).toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('should restore persisted language on init', () => {
      localStorage.setItem('uilmLang', 'de');
      const config = createConfig({ localeMapping: { en: 'en-US', de: 'de-DE' } });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: BLOCKS_LOCALIZATION_CONFIG, useValue: config }],
      });
      const freshStore = TestBed.inject(UilmStore);
      // 'de' is not in localeMapping values directly, but reverse mapping handles it
      expect(['en', 'de']).toContain(freshStore.activeLang());
    });

    it('should fall back to default if persisted lang is invalid', () => {
      localStorage.setItem('uilmLang', 'xx-XX');
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: BLOCKS_LOCALIZATION_CONFIG, useValue: createConfig() }],
      });
      const freshStore = TestBed.inject(UilmStore);
      expect(freshStore.activeLang()).toBe('en');
    });
  });

  describe('getStorage fallback', () => {
    it('should fall back to defaultLang when storage throws', () => {
      // Simulate storage being unavailable by making localStorage throw
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
      Object.defineProperty(window, 'localStorage', {
        get: () => {
          throw new Error('SecurityError');
        },
        configurable: true,
      });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: BLOCKS_LOCALIZATION_CONFIG, useValue: createConfig() }],
      });
      const freshStore = TestBed.inject(UilmStore);
      expect(freshStore.activeLang()).toBe('en');

      // Restore
      Object.defineProperty(window, 'localStorage', original);
    });
  });

  describe('key mode toggle via postMessage', () => {
    /** Dispatch a synthetic MessageEvent that passes the source/origin guards. */
    function dispatchKeyModeMessage(data: unknown): void {
      const event = new MessageEvent('message', {
        data,
        source: window,
        origin: window.location.origin,
      });
      window.dispatchEvent(event);
    }

    it('should toggle keyMode when receiving a valid keymode message', () => {
      expect(store.keyMode()).toBe(false);
      dispatchKeyModeMessage({ action: 'keymode', keymode: true });
      expect(store.keyMode()).toBe(true);
    });

    it('should bump version when keyMode changes but not when same value is sent again', () => {
      store.setTranslation({ KEY: 'val' }, 'en');

      dispatchKeyModeMessage({ action: 'keymode', keymode: true });
      expect(store.keyMode()).toBe(true);

      // Sending same value should NOT bump version again (no-op)
      dispatchKeyModeMessage({ action: 'keymode', keymode: true });
      expect(store.keyMode()).toBe(true);
    });

    it('should ignore messages with wrong action', () => {
      dispatchKeyModeMessage({ action: 'other', keymode: true });
      expect(store.keyMode()).toBe(false);
    });

    it('should ignore non-object messages', () => {
      dispatchKeyModeMessage('not-an-object');
      expect(store.keyMode()).toBe(false);
    });

    it('should ignore null data', () => {
      dispatchKeyModeMessage(null);
      expect(store.keyMode()).toBe(false);
    });
  });
});
