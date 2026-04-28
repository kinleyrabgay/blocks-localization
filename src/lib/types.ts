/**
 * Controls how translations are loaded at application startup.
 *
 * - `'modular'` — Lazy per-route loading via `provideUilmScope()`.
 *   Shows empty placeholders while fetching. Best for large apps
 *   with many modules where loading everything upfront is wasteful.
 *
 * - `'eager'` — All modules listed in `preloadModules` are fetched
 *   before the app renders. Blocks bootstrap via `APP_INITIALIZER`.
 *   Best for smaller apps or when avoiding placeholder flicker matters.
 */
export type UilmLoadingStrategy = 'modular' | 'eager';

/**
 * Controls where translations are persisted.
 *
 * - `'memory'`   — In-memory cache only (cleared on page reload).
 * - `'indexeddb'` — Persists to IndexedDB alongside in-memory cache.
 *   Translations load instantly from disk on subsequent visits while
 *   the in-memory L1 cache provides zero-latency lookups within a session.
 */
export type UilmCacheStorage = 'memory' | 'indexeddb';

/**
 * Controls where the active language preference is persisted.
 *
 * - `'localStorage'`   — Persists across browser sessions (default).
 * - `'sessionStorage'` — Persists only for the current tab/session.
 * - `'none'`           — No persistence; always starts with `defaultLang`.
 */
export type UilmLangStorage = 'localStorage' | 'sessionStorage' | 'none';

/** A module entry: plain string or an object with an optional alias. */
export type UilmModuleEntry = string | { module: string; alias?: string };

/**
 * Root configuration for the blocks-localization library.
 *
 * @publicApi
 */
export interface BlocksLocalizationConfig {
  /** UILM API base URL, e.g. `'https://api.seliseblocks.com/uilm/v1'` */
  uilmApiBaseUrl: string;

  /** Project key sent as `x-blocks-key` header. */
  projectKey: string;

  /** Optional Bearer token for authenticated UILM access. */
  accessToken?: string;

  /** Short language codes, e.g. `['en', 'de', 'fr', 'it']`. */
  availableLangs: readonly string[];

  /** Default language short code, e.g. `'en'`. */
  defaultLang: string;

  /** Maps short codes → full locale codes, e.g. `{ en: 'en-US', de: 'de-DE' }`. */
  localeMapping?: Readonly<Record<string, string>>;

  /**
   * Cache TTL in milliseconds. `0` means no expiry — cached translations are served
   * until explicitly cleared or the session ends (memory) / storage is cleared (IndexedDB).
   * @defaultValue `0`
   */
  cacheTimeout?: number;

  /**
   * Where to persist the translation cache.
   *
   * - `'memory'`    — In-memory only (default, current behavior).
   * - `'indexeddb'`  — Persists to IndexedDB. Translations survive page reloads
   *   and are available instantly on subsequent visits. In-memory cache still
   *   serves as L1 for zero-latency lookups within the same session.
   *
   * @defaultValue `'memory'`
   */
  cacheStorage?: UilmCacheStorage;

  /**
   * When `cacheStorage` is `'indexeddb'` and a cached entry exists, serve
   * it immediately and revalidate from the API in the background.
   * Updated translations are merged into the store silently without blocking the UI.
   * Has no effect when `cacheStorage` is `'memory'`.
   * @defaultValue `false`
   */
  revalidateInBackground?: boolean;

  /**
   * Prefix translation keys with the module name/alias
   * (e.g. `"dashboard.LABEL.HELLO"`).
   * @defaultValue `false`
   */
  prefixKeysWithModule?: boolean;

  /**
   * Enable production mode (suppresses console warnings).
   * @defaultValue `false`
   */
  prodMode?: boolean;

  /**
   * Fall back to local JSON files when the UILM API request fails.
   *
   * Local files are expected at `{localAssetsPath}/{moduleName}/{lang}.json`
   * (nested JSON is flattened to dot-notation keys automatically).
   * For modules with an empty-string alias (e.g. `common`), the path is
   * `{localAssetsPath}/{lang}.json`.
   *
   * @defaultValue `true`
   */
  fallbackToLocal?: boolean;

  /**
   * Base path for local fallback JSON files (relative to the app's public root).
   * @defaultValue `'assets/i18n'`
   */
  localAssetsPath?: string;

  /**
   * Where to persist the active language preference.
   *
   * - `'localStorage'`   — Persists across browser sessions (default).
   * - `'sessionStorage'` — Persists only for the current tab/session.
   * - `'none'`           — No persistence; always starts with `defaultLang`.
   *
   * The storage key used is `uilmLang` (or custom via `langStorageKey`).
   *
   * @defaultValue `'localStorage'`
   */
  langStorage?: UilmLangStorage;

  /**
   * Custom storage key for persisting the active language.
   * @defaultValue `'uilmLang'`
   */
  langStorageKey?: string;

  /**
   * Translation loading strategy.
   *
   * - `'modular'` — lazy per-route loading, empty placeholders while fetching
   * - `'eager'`   — all `preloadModules` fetched on startup, blocks rendering until ready
   *
   * @defaultValue `'modular'`
   */
  strategy?: UilmLoadingStrategy;

  /**
   * Modules to preload at app startup (before any route loads).
   *
   * In `'modular'` mode these are loaded alongside route-level modules.
   * In `'eager'` mode these should include **all** module scopes — route-level
   * `provideUilmScope()` calls will skip fetching if translations are already cached.
   *
   * @example
   * ```typescript
   * preloadModules: ['common', { module: 'shared', alias: 'sh' }]
   * ```
   */
  preloadModules?: UilmModuleEntry[];
}

/** Language entity returned by the UILM API. */
export interface UilmLanguage {
  itemId: string;
  languageName: string;
  languageCode: string;
  isDefault: boolean;
  projectKey: string | null;
}

/** Module entity returned by the UILM API. */
export interface UilmModule {
  moduleName: string;
  name: string | null;
  itemId: string;
  createDate: string;
  lastUpdateDate: string;
  createdBy: string | null;
  lastUpdatedBy: string | null;
  tenantId: string | null;
}
