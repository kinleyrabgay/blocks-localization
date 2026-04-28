# Changelog

All notable changes to `@selisedev/blocks-localization` are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

_Add entries here as you work. Move them to a versioned section on release._

---

## [0.2.4] - 2026-04-28

### Fixed

- **Missing translation fallback shows blank instead of key** — `*uilmTranslate` directive and `uilmTranslate` pipe now return the raw key when no translation is found, instead of invisible non-breaking spaces. This makes untranslated or already-translated values (e.g. display labels passed through `t()`) visible in the UI rather than appearing empty.

---

## [0.2.3] - 2026-04-28

### Fixed

- **Cache hydration race condition** — when `revalidateInBackground` is enabled, IndexedDB cache hydration now checks `store.ready()` before writing. Prevents stale cached data from overwriting fresher API data that arrived first.
- **Subscription leak in background revalidation** — `revalidateFromApi()` now uses `takeUntilDestroyed()` to auto-clean subscriptions when the loader is destroyed.
- **Malformed API response crash** — HTTP responses are now validated before use. `null`, arrays, and non-object responses are sanitized to empty `{}` instead of crashing downstream code.
- **`flattenJson` circular reference crash** — recursive flattening now tracks visited objects and skips circular references instead of stack overflowing.
- **Expensive `JSON.stringify` equality check** — background revalidation now uses a shallow key-by-key comparison for `TranslationMap` equality, which is faster and order-independent.
- **Event listener leak in `UilmStore`** — the `window.postMessage` listener for key mode toggle is now removed via `DestroyRef.onDestroy()` when the store is destroyed.
- **Unsafe interpolation with array intermediates** — dotted path interpolation (e.g. `{{ user.name }}`) now correctly skips array intermediates instead of treating them as objects.
- **Non-null assertion patterns** — replaced `memCache.get(key)!.data` with safe access patterns throughout the loader.

---

## [0.2.2] - 2026-04-28

### Added

- **Stale-while-revalidate for IndexedDB cache** — new `revalidateInBackground` config option. When `cacheStorage: 'indexeddb'` and cached translations exist, the UI renders immediately from cache while the SDK fetches fresh translations from the API in the background. If the API returns updated data, caches and the store are silently updated without blocking the UI. Only blocks when there is no cached data at all.

---

## [0.2.1] - 2026-04-28

### Added

- **Custom loading screen template** — `UilmLoadingScreenComponent` now accepts an optional `customTemplate` input (`TemplateRef`). When provided, the entire default loading UI (logo, title, description, progress bar) is replaced by your custom template, giving full control over the loading screen's appearance.

---

## [0.2.0] - 2026-04-27

### Added

- **Configurable language persistence** — new `langStorage` config option (`'localStorage'` | `'sessionStorage'` | `'none'`). Defaults to `'localStorage'` (existing behavior). Use `'sessionStorage'` for per-tab language preference, or `'none'` to disable persistence entirely.
- **Custom language storage key** — new `langStorageKey` config option. Defaults to `'uilmLang'`. Useful when multiple apps share the same origin and need separate language preferences.
- **`UilmLangStorage` type** — exported for consumers who need to type the config.

### Fixed

- **Pipe cache ignoring `params` changes** — `uilmTranslate` pipe now includes interpolation parameters in its memoization check. Previously, changing params with the same key returned stale output.
- **L1/L2 cache `cacheTimeout=0` inconsistency** — `cacheTimeout: 0` now consistently means "no expiry" across both L1 (in-memory) and L2 (IndexedDB). Previously L1 treated `0` as "always invalid" while L2 treated it as "always valid", effectively disabling caching for all default-config users.
- **Directive DOM teardown on language change** — `*uilmTranslate` now updates the embedded view context in-place instead of destroying and recreating the DOM tree. Preserves focus, scroll position, and animation state during language switches.
- **Duplicate metadata HTTP requests** — `ensureMetadataLoaded()` now deduplicates concurrent calls. Previously, simultaneous calls both passed the guard and issued duplicate HTTP requests for modules/languages.
- **API overwriting user locale mappings** — `getAvailableLanguages()` no longer overwrites `localeMapping` entries provided in config. User-configured mappings now take precedence over API-derived ones.
- **IndexedDB blocking tab upgrades** — Added `onversionchange` handler so other tabs can upgrade the database without stalling.
- **IndexedDB stale connection after unexpected close** — Added `onclose` handler and automatic reconnection logic. Previously, if the browser closed the IndexedDB connection (storage pressure, user clearing data), the service kept using the dead handle with no recovery.
- **`window.location.reload()` crash in SSR** — `BlocksLangSwitcher.setActiveLang()` now guards the reload call with `typeof window !== 'undefined'`.
- **`multiLang` pipe returning empty string** — Now falls back to the default language value when the active language key is missing from a multilingual object.
- **Non-deterministic test language** — `provideBlocksLocalizationTesting()` now explicitly sets `activeLang` to `defaultLang`, preventing leftover `localStorage` from leaking between tests.
- **`setActiveLang` accepting invalid languages** — Now validates against `availableLangs` and logs a warning instead of silently persisting an invalid code to localStorage.
- **Empty `modules: []` in `provideUilmScope`** — Now early-returns instead of triggering a pointless `forkJoin` and no-op `setTranslation`.
- **`projectKey` not URL-encoded** — Metadata API URLs now encode `projectKey` to handle special characters.
- **Metadata fetch retry on empty API response** — `getAvailableLanguages()`/`getAvailableModules()` now set `loaded = true` even on error, preventing infinite retry loops.

### Changed

- **Interpolation supports dotted paths** — `{{ user.name }}` now resolves `params.user.name` via deep property access. Previously only simple `\w+` parameter names were supported.
- **`flattenJson` handles arrays** — Arrays are now flattened with numeric indices (e.g. `ARR.0`, `ARR.1`) instead of being silently coerced to comma-separated strings.
- **Version counter uses modular arithmetic** — `UilmStore._version` now wraps at `0x7fffffff` instead of incrementing unboundedly toward `MAX_SAFE_INTEGER`.

### Removed

- Unnecessary `untracked()` wrappers on plain variables in `provideBlocksLocalization` and `provideUilmScope`.

### Infrastructure

- Upgraded dev dependencies from Angular 19 to Angular 20 (required by `@analogjs/vitest-angular@2.2+`).
- Added missing dev dependencies: `@angular/build`, `jsdom`, `autoprefixer`, `typescript-eslint`, `eslint-plugin-simple-import-sort`.
- Added `overrides` in `package.json` to resolve `@angular/build` / `vitest` peer conflict.
- Fixed lint errors (unused variables, import sorting) and formatting across 12 files.

---

## [0.1.0] - 2026-04-27

### Added

- **Two-tier caching (L1 + L2):** New `cacheStorage` config option.
  - `'memory'` (default) — in-memory cache only, same as before.
  - `'indexeddb'` — persists translations to IndexedDB across page reloads. In-memory cache serves as L1 for zero-latency lookups, IndexedDB as L2 for cross-session persistence.
- **`UilmIndexedDbCache` service** — standalone IndexedDB persistence layer with `get`, `getStale`, `set`, `clear` methods. Fire-and-forget safe (silently degrades when IndexedDB unavailable).
- **`UilmCacheStorage` type** — `'memory' | 'indexeddb'`.
- **Full fallback chain on API failure:** stale L1 -> stale L2 -> local JSON -> empty `{}`.
- **Test infrastructure:** Vitest + `@analogjs/vitest-angular` setup with 69 tests across 8 spec files.
- **CI/CD pipeline:** GitHub Actions workflow for automated lint, test, build, and npm publish.
- **Documentation:** `DEPLOYMENT.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.

### Changed

- **`UilmLoader` refactored** for DRY/SOLID compliance:
  - Extracted `populateCache()` — single method writes to both L1 and L2.
  - Extracted `resolveTranslation()` — orchestrates L2 -> HTTP pipeline.
  - Extracted `resolveFromFallbacks()` — unified fallback chain (was duplicated).
  - Extracted `isL1Valid()` — reusable TTL check.
  - Renamed internal `moduleCache` -> `memCache` for clarity with L1/L2 terminology.
- **`clearCache()` now clears IndexedDB** when `cacheStorage: 'indexeddb'` is enabled.
- **`lang-switcher/` folder flattened** — `lang-switcher.ts` moved from `lang-switcher/lang-switcher.ts` to `lib/lang-switcher.ts`.
- **`package.json` description** updated to mention two-tier caching.

---

## [0.0.1] - 2026-04-14

### Added

- Initial release.
- **Signal-based translation store** (`UilmStore`) with `activeLang`, `version`, `ready` signals.
- **Two loading strategies:** `'modular'` (lazy per-route) and `'eager'` (all upfront).
- **`provideBlocksLocalization()`** — root-level provider with full config.
- **`provideUilmScope()`** — route-level lazy module loading.
- **`UilmTranslateDirective`** — `*uilmTranslate="let t"` with optional scope.
- **`UilmTranslatePipe`** — `{{ key | uilmTranslate }}`.
- **`MultiLangPipe`** — `{{ obj | multiLang }}`.
- **`UilmTranslateService`** — signal-based `t()`, sync `translate()`, batch `tMany()`.
- **`BlocksLangSwitcher`** — programmatic language switching with `setActiveLang()`.
- **`UilmLoadingScreenComponent`** — centered loading screen for eager strategy.
- **`UilmLoader`** — HTTP client with in-memory caching, in-flight deduplication, and local JSON fallback.
- **`{{ param }}` interpolation** in translation values.
- **Local JSON fallback** — auto-flattens nested JSON to dot-notation keys.
- **`provideBlocksLocalizationTesting()`** — zero-HTTP test helper.
- **Utility functions:** `flattenJson`, `createI18nRecord`, `toFullLangCode`, `toShortLangCode`, `buildReverseMapping`.
