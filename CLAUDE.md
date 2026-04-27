# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

`@selisedev/blocks-localization` — an Angular library (published via ng-packagr) providing signal-based i18n powered by the SELISE UILM API. Two-tier caching (in-memory + IndexedDB), two loading strategies (modular/eager), route-level scoping, and local JSON fallback.

## Commands

```bash
npm run build          # dev build (ng-packagr)
npm run build:prod     # production build
npm test               # vitest run (single pass)
npm run test:watch     # vitest watch mode
npm run test:coverage  # vitest with coverage
npm run lint           # eslint src/
npm run lint:fix       # eslint --fix
npm run format         # prettier write
npm run format:check   # prettier check
```

Run a single test file: `npx vitest run --config vite.config.mts src/lib/uilm-store.spec.ts`

Tests use Vitest + jsdom + `@analogjs/vitest-angular`. Test setup is in `src/test-setup.ts`.

## Architecture

This is a standalone Angular library (not part of a larger Nx workspace despite having `project.json`). Source lives in `src/`, public API is exported from `src/index.ts`.

### Core layers (data flows top-down):

- **`provide-blocks-localization.ts`** — App-level provider factory. Configures strategy (modular vs eager), registers `APP_INITIALIZER` for eager mode.
- **`provide-uilm-scope.ts`** — Route-level provider. Lazy-loads translation modules when a route activates; no-op in eager mode for already-cached languages.
- **`uilm-store.ts`** — Central signal-based store. Holds `activeLang`, `version`, `ready` signals. All translation lookups go through here. Persists active lang to localStorage.
- **`uilm-loader.ts`** — HTTP + caching layer. Lookup order: L1 (memory) → in-flight dedup → L2 (IndexedDB) → UILM API → stale caches → local JSON fallback.
- **`uilm-indexeddb-cache.ts`** — IndexedDB persistence with TTL. Degrades silently if IndexedDB is unavailable.
- **`tokens.ts`** / **`types.ts`** — DI tokens (`BLOCKS_LOCALIZATION_CONFIG`) and type definitions.

### Consumer-facing APIs:

- **`UilmTranslateDirective`** — structural directive `*uilmTranslate="let t"` with optional scope
- **`UilmTranslatePipe`** / **`MultiLangPipe`** — template pipes
- **`UilmTranslateService`** — injectable service with `t()` (signal), `translate()` (sync), `tMany()` (batch)
- **`BlocksLangSwitcher`** (`lang-switcher.ts`) — language switching service
- **`UilmLoadingScreenComponent`** — loading screen for eager mode

### Testing helper:

`provideBlocksLocalizationTesting()` in `src/testing/` — provides an in-memory store pre-loaded with translations, no HTTP needed.

## Key Patterns

- Angular signals throughout (no RxJS subscriptions in consumer code). Internal RxJS uses `takeUntilDestroyed`.
- Translation keys use dot-notation: `module.CATEGORY.KEY` (e.g., `dashboard.LABEL.TITLE`).
- `{{ param }}` interpolation in translation values.
- `prefixKeysWithModule` controls whether keys are auto-namespaced by module/alias.
- Peer dependencies: Angular >=17, RxJS >=7. Dev uses Angular 19.
