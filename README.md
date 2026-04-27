# @selisedev/blocks-localization

Standalone Angular SDK for SELISE UILM (Unified Internationalization & Localization Management).

**Zero external translation dependencies** — no Transloco, ngx-translate, or similar. Built entirely on Angular signals with two loading strategies, two-tier caching (in-memory + IndexedDB), local JSON fallback, module aliasing, and route-level scoping.

---

## Setup

### 1. Choose a loading strategy

The SDK supports two strategies for loading translations:

| Strategy | Behaviour | Best for |
|---|---|---|
| `'modular'` (default) | Lazy per-route loading via `provideUilmScope()`. Shows empty placeholders while fetching. | Large apps with many modules |
| `'eager'` | All modules fetched **before** the app renders (blocks bootstrap). No flicker. | Smaller apps or flicker-sensitive UIs |

### 2. App-level configuration

#### Modular strategy (default)

```typescript
// app.config.ts
import { provideBlocksLocalization } from '@selisedev/blocks-localization';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBlocksLocalization({
      uilmApiBaseUrl: 'https://api.seliseblocks.com/uilm/v1',
      projectKey: 'YOUR_PROJECT_KEY',
      accessToken: 'OPTIONAL_BEARER_TOKEN',
      availableLangs: ['en', 'de', 'fr', 'it'],
      defaultLang: 'en',
      localeMapping: { en: 'en-US', de: 'de-DE', fr: 'fr-FR', it: 'it-IT' },
      prefixKeysWithModule: true,
      cacheTimeout: 300_000,        // 5 min TTL (0 = no cache)
      cacheStorage: 'indexeddb',    // persist across sessions (default: 'memory')
      preloadModules: ['common'],   // only shared module preloaded
    }),
  ],
};
```

Then use `provideUilmScope()` on each route to load module-specific translations lazily (see [Route-level module loading](#3-route-level-module-loading)).

#### Eager strategy

```typescript
// app.config.ts
import { provideBlocksLocalization } from '@selisedev/blocks-localization';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBlocksLocalization({
      uilmApiBaseUrl: 'https://api.seliseblocks.com/uilm/v1',
      projectKey: 'YOUR_PROJECT_KEY',
      accessToken: 'OPTIONAL_BEARER_TOKEN',
      availableLangs: ['en', 'de', 'fr', 'it'],
      defaultLang: 'en',
      localeMapping: { en: 'en-US', de: 'de-DE', fr: 'fr-FR', it: 'it-IT' },
      prefixKeysWithModule: true,
      strategy: 'eager',
      cacheStorage: 'indexeddb',
      cacheTimeout: 300_000,
      preloadModules: [
        { module: 'common', alias: '' },
        { module: 'opportunity', alias: 'op' },
        { module: 'backend', alias: 'be' },
        { module: 'service', alias: 'sv' },
        'dashboard',
        'invoice',
        'customer',
        // ... list ALL module scopes here
      ],
    }),
  ],
};
```

In eager mode, `provideUilmScope()` on routes becomes a **no-op** for the initial language (translations are already cached). Language switches re-fetch automatically in both modes.

### 3. Route-level module loading

Use `provideUilmScope` to declare which UILM modules a route needs:

```typescript
// dashboard.route.ts
import { provideUilmScope } from '@selisedev/blocks-localization';

export const DASHBOARD_ROUTE: Route[] = [{
  path: 'dashboard',
  providers: [
    provideUilmScope({
      modules: [
        'dashboard',                              // prefix: dashboard.KEY
        { module: 'opportunity', alias: 'op' },   // prefix: op.KEY
        { module: 'backend', alias: 'be' },       // prefix: be.KEY
      ],
    }),
  ],
  children: [
    { path: '', loadComponent: () => import('./dashboard').then(c => c.Dashboard) },
  ],
}];
```

### 4. Loading screen (eager mode)

When using `'eager'` strategy, you can show a loading screen while translations are being fetched. The SDK provides a ready-made component:

```typescript
import { UilmLoadingScreenComponent, UilmStore } from '@selisedev/blocks-localization';

@Component({
  imports: [UilmLoadingScreenComponent, RouterOutlet],
  template: `
    @if (!store.ready()) {
      <uilm-loading-screen
        title="Loading"
        description="Loading translations..." />
    } @else {
      <router-outlet />
    }
  `,
})
export class AppComponent {
  protected readonly store = inject(UilmStore);
}
```

The component renders a centered full-screen overlay with a spinner. Both `title` and `description` are configurable via inputs.

> **Note:** In eager mode the `APP_INITIALIZER` blocks Angular bootstrap, so `store.ready()` is `true` by the time the app renders. The loading screen is most useful if you combine eager preloading of some modules with lazy loading of others.

---

## Translation APIs

### Directive: `*uilmTranslate`

Structural directive providing a translation function. Re-renders on language/translation changes.

```html
<section *uilmTranslate="let t">
  <h1>{{ t('dashboard.LABEL.TITLE') }}</h1>
  <p>{{ t('dashboard.HINT.WELCOME', { name: userName }) }}</p>
</section>
```

With scope (auto-prefixes keys):

```html
<section *uilmTranslate="let t; scope: 'dashboard'">
  <h1>{{ t('LABEL.TITLE') }}</h1>  <!-- resolves to dashboard.LABEL.TITLE -->
</section>
```

**Component setup:**
```typescript
import { UilmTranslateDirective } from '@selisedev/blocks-localization';

@Component({
  imports: [UilmTranslateDirective],
  ...
})
```

### Pipe: `uilmTranslate`

Inline pipe for simple translations:

```html
<p>{{ 'dashboard.LABEL.TITLE' | uilmTranslate }}</p>
<p>{{ 'dashboard.HINT.WELCOME' | uilmTranslate: { name: userName } }}</p>
```

**Component setup:**
```typescript
import { UilmTranslatePipe } from '@selisedev/blocks-localization';

@Component({
  imports: [UilmTranslatePipe],
  ...
})
```

### Pipe: `multiLang`

Resolves a multilingual object to the value matching the active language. Falls back to the default language if the active language key is missing:

```html
<!-- Given: { en: 'Hello', de: 'Hallo', fr: 'Bonjour' } -->
{{ item.name | multiLang }}  <!-- outputs 'Hello' when lang is 'en' -->

<!-- Given: { en: 'Hello' } with active lang 'de' -->
{{ item.name | multiLang }}  <!-- falls back to 'Hello' (default lang) -->
```

**Component setup:**
```typescript
import { MultiLangPipe } from '@selisedev/blocks-localization';

@Component({
  imports: [MultiLangPipe],
  ...
})
```

### Service: `UilmTranslateService`

Signal-based service for component classes:

```typescript
import { UilmTranslateService } from '@selisedev/blocks-localization';

@Component({ ... })
export class MyComponent {
  private readonly uilm = inject(UilmTranslateService);

  // Signal-based (reactive — updates on lang change + translation load)
  title = this.uilm.t('dashboard.LABEL.TITLE');
  // In template: {{ title() }}

  // Batch signals
  labels = this.uilm.tMany(['dashboard.LABEL.TITLE', 'dashboard.LABEL.SUBTITLE']);
  // In template: {{ labels()['dashboard.LABEL.TITLE'] }}

  // Sync snapshot (does NOT react to changes)
  label = this.uilm.translate('dashboard.LABEL.TITLE');

  // Active language signal
  lang = this.uilm.activeLang;  // Signal<string>
}
```

---

## Language Switching

```typescript
import { BlocksLangSwitcher } from '@selisedev/blocks-localization';

@Component({ ... })
export class LangSwitcher {
  private readonly langSwitcher = inject(BlocksLangSwitcher);

  // Signal
  currentLang = this.langSwitcher.activeLang;

  switchTo(lang: string): void {
    this.langSwitcher.setActiveLang(lang);
    // Translations re-fetch automatically.
    // Logs a warning and no-ops if `lang` is not in `availableLangs`.
  }
}
```

---

## Interpolation

Values from the UILM API support `{{ param }}` interpolation, including dotted paths for nested objects:

```
API value: "Hello {{ name }}, you have {{ count }} items"
API value: "Welcome {{ user.name }} from {{ user.company }}"
```

```html
{{ t('LABEL.GREETING', { name: 'John', count: 5 }) }}
<!-- Output: Hello John, you have 5 items -->

{{ t('LABEL.WELCOME', { user: { name: 'Jane', company: 'SELISE' } }) }}
<!-- Output: Welcome Jane from SELISE -->
```

---

## Caching

### Two-tier cache architecture

The SDK uses a two-tier caching system for optimal performance:

| Layer | Storage | Lifetime | When active |
|-------|---------|----------|-------------|
| **L1** | In-memory `Map` | Current browser session | Always |
| **L2** | IndexedDB | Cross-session (survives reload) | `cacheStorage: 'indexeddb'` |

### Lookup order

```
1. L1 hit (in-memory, valid TTL)  → return instantly
2. In-flight dedup                → share existing HTTP Observable
3. L2 hit (IndexedDB, valid TTL)  → populate L1, return
4. HTTP fetch (UILM API)          → populate L1 + L2, return
5. Error fallback chain:
   └─ Stale L1 → Stale L2 → Local JSON → empty {}
```

### Configuration

```typescript
provideBlocksLocalization({
  // ...
  cacheTimeout: 300_000,          // 5 min TTL (0 = no expiry, cached until cleared)
  cacheStorage: 'indexeddb',      // 'memory' (default) | 'indexeddb'
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `cacheTimeout` | `number` | `0` | Cache TTL in milliseconds. `0` means no expiry (cached until cleared). |
| `cacheStorage` | `'memory' \| 'indexeddb'` | `'memory'` | Where to persist cached translations. `'indexeddb'` enables cross-session persistence. |

### How it works

- **`'memory'` (default):** L1-only. Translations are cached in a JS `Map` for the duration of the session. Page reload fetches everything fresh.
- **`'indexeddb'`:** L1 + L2. On first load, translations are fetched from the API and stored in both memory and IndexedDB. On subsequent page loads, translations are served instantly from IndexedDB (L2) while in-memory cache (L1) provides zero-latency lookups within the session.

### Fault tolerance

IndexedDB operations are **fire-and-forget safe**:
- If IndexedDB is unavailable (SSR, restrictive incognito, quota exceeded), the SDK silently falls back to memory-only mode.
- No errors are thrown, no user-facing impact — caching simply degrades gracefully.
- If the browser closes the IndexedDB connection (storage pressure, user clearing data), the SDK automatically reconnects.
- Multi-tab safe: the SDK yields its database connection when another tab needs to upgrade, then reconnects.
- On API failure, the SDK tries stale L1, then stale L2 (ignoring TTL), then local JSON files, before returning an empty map.

---

## Local JSON Fallback

When the UILM API is unreachable, the SDK automatically falls back to local JSON files. This is enabled by default.

### File structure

```
assets/i18n/
  en.json                   # root/common module (alias: '')
  de.json
  dashboard/
    en.json                 # dashboard module
    de.json
  opportunity/
    en.json                 # opportunity module
    de.json
```

### Nested JSON is flattened automatically

Local files use nested JSON:
```json
{
  "LABEL": {
    "TITLE": "Dashboard",
    "WELCOME": "Welcome {{ name }}"
  }
}
```

The SDK flattens this to dot-notation (`LABEL.TITLE`, `LABEL.WELCOME`) to match the UILM API format. If `prefixKeysWithModule` is enabled, the module prefix is also applied (e.g. `dashboard.LABEL.TITLE`).

### Configuration

```typescript
provideBlocksLocalization({
  // ...
  fallbackToLocal: true,            // default: true (set false to disable)
  localAssetsPath: 'assets/i18n',   // default
})
```

---

## Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `uilmApiBaseUrl` | `string` | *required* | UILM API base URL |
| `projectKey` | `string` | *required* | Project key for `x-blocks-key` header |
| `accessToken` | `string` | — | Optional Bearer token |
| `availableLangs` | `string[]` | *required* | Available language short codes |
| `defaultLang` | `string` | *required* | Default language short code |
| `localeMapping` | `Record<string, string>` | — | Short to full locale mapping |
| `strategy` | `'modular' \| 'eager'` | `'modular'` | Loading strategy (see [above](#1-choose-a-loading-strategy)) |
| `preloadModules` | `UilmModuleEntry[]` | — | Modules to preload at startup. In eager mode, list **all** modules here. |
| `cacheTimeout` | `number` | `0` | Cache TTL in ms (`0` = no expiry) |
| `cacheStorage` | `'memory' \| 'indexeddb'` | `'memory'` | Cache persistence layer (see [Caching](#caching)) |
| `prefixKeysWithModule` | `boolean` | `false` | Namespace keys with module/alias |
| `fallbackToLocal` | `boolean` | `true` | Fall back to local JSON files on API failure |
| `localAssetsPath` | `string` | `'assets/i18n'` | Base path for local fallback JSON files |
| `langStorage` | `'localStorage' \| 'sessionStorage' \| 'none'` | `'localStorage'` | Where to persist the active language preference |
| `langStorageKey` | `string` | `'uilmLang'` | Custom storage key for the active language |
| `prodMode` | `boolean` | `false` | Suppress warnings |

---

## Architecture

```
provideBlocksLocalization(config)       App-level: config + strategy + preload
    |
    |-- [eager] provideAppInitializer   Blocks bootstrap until all modules loaded
    |-- [modular] preloadModules only   Loads shared modules, routes load the rest
    |
    +-- UilmStore                       Signal-based reactive translation store
    |     activeLang: Signal<string>
    |     version: Signal<number>
    |     ready: Signal<boolean>
    |     translate(key, params)
    |     setTranslation(data, lang)
    |
    +-- UilmLoader                      HTTP layer with two-tier cache
    |     L1: in-memory Map             Always active
    |     L2: UilmIndexedDbCache        Active when cacheStorage='indexeddb'
    |     fetchModuleTranslations()     L1 -> L2 -> API -> fallbacks
    |     ensureMetadataLoaded()
    |     clearCache()                  Clears L1 + L2 + in-flight
    |
    +-- UilmIndexedDbCache              IndexedDB persistence layer
    |     get(key, ttl)                 TTL-aware read
    |     getStale(key)                 Read ignoring TTL (for fallback)
    |     set(key, data)                Fire-and-forget write
    |     clear()                       Wipe all stored translations
    |
provideUilmScope({ modules })          Route-level: lazy load + merge into store
    |                                   (no-op in eager mode for initial language)
    |
    +-- UilmTranslateDirective          *uilmTranslate="let t; scope: 'x'"
    +-- UilmTranslatePipe               {{ key | uilmTranslate }}
    +-- UilmTranslateService            inject() -> t(), translate(), tMany()
    +-- MultiLangPipe                   {{ obj | multiLang }}
    +-- BlocksLangSwitcher              setActiveLang(), getAvailableLangs()
    +-- UilmLoadingScreenComponent      Centered loading UI for eager mode
```

### Reactivity
- `UilmStore.activeLang`, `version`, and `ready` are Angular signals
- All pipes, directives, and service methods react to both language changes and new translation loads
- No RxJS subscriptions leak — `DestroyRef` + `takeUntilDestroyed` throughout

---

## Public API

| Export | Kind | Purpose |
|---|---|---|
| `provideBlocksLocalization` | Provider | App-level setup + strategy + preload |
| `provideUilmScope` | Provider | Route-level lazy module loading |
| `UilmStore` | Service | Core reactive translation store |
| `UilmLoader` | Service | Low-level UILM API access + two-tier cache |
| `UilmIndexedDbCache` | Service | IndexedDB persistence layer |
| `UilmTranslateDirective` | Directive | `*uilmTranslate="let t"` |
| `UilmTranslatePipe` | Pipe | `{{ key \| uilmTranslate }}` |
| `MultiLangPipe` | Pipe | `{{ obj \| multiLang }}` |
| `UilmTranslateService` | Service | Signal/sync translations for TS |
| `BlocksLangSwitcher` | Service | Language switching |
| `UilmLoadingScreenComponent` | Component | Centered loading screen for eager mode |
| `TranslationMap` | Type | `Record<string, string>` alias |
| `UilmLangStorage` | Type | `'localStorage' \| 'sessionStorage' \| 'none'` |
| `UilmLoadingStrategy` | Type | `'modular' \| 'eager'` |
| `UilmCacheStorage` | Type | `'memory' \| 'indexeddb'` |
| `UilmModuleEntry` | Type | `string \| { module: string; alias?: string }` |
| `flattenJson` | Utility | Flatten nested JSON to dot-notation keys |
| `createI18nRecord` | Utility | Create empty i18n records |
| `toFullLangCode` / `toShortLangCode` | Utility | Language code conversion |
| `buildReverseMapping` | Utility | Reverse a locale mapping |
| `provideBlocksLocalizationTesting` | Provider | In-memory store for tests |

---

## Testing

### Test helper

The SDK provides `provideBlocksLocalizationTesting` for unit tests - no HTTP calls, no UILM API. Translations are loaded directly into the store.

```typescript
import { provideBlocksLocalizationTesting } from '@selisedev/blocks-localization';

TestBed.configureTestingModule({
  providers: [
    provideBlocksLocalizationTesting({
      en: { 'dashboard.LABEL.HELLO': 'Hello', 'dashboard.LABEL.WORLD': 'World' },
      de: { 'dashboard.LABEL.HELLO': 'Hallo', 'dashboard.LABEL.WORLD': 'Welt' },
    }),
  ],
});
```

You can override any config option:

```typescript
provideBlocksLocalizationTesting(
  { en: {}, de: {} },
  { defaultLang: 'de' },  // start in German
)
```

### Testing components that use translations

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideBlocksLocalizationTesting, UilmTranslateDirective } from '@selisedev/blocks-localization';

import { MyComponent } from './my.component';

describe('MyComponent', () => {
  let fixture: ComponentFixture<MyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [
        provideBlocksLocalizationTesting({
          en: {
            'dashboard.LABEL.TITLE': 'Dashboard',
            'dashboard.HINT.WELCOME': 'Welcome {{ name }}',
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();
  });

  it('should render translated title', () => {
    expect(fixture.nativeElement.textContent).toContain('Dashboard');
  });
});
```

### Testing language switching

```typescript
import { UilmStore } from '@selisedev/blocks-localization';

it('should update when language changes', () => {
  const store = TestBed.inject(UilmStore);

  expect(fixture.nativeElement.textContent).toContain('Hello');

  store.setActiveLang('de');
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Hallo');
});
```

### Testing the UilmLoader with HTTP mocks

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BLOCKS_LOCALIZATION_CONFIG, UilmIndexedDbCache, UilmLoader } from '@selisedev/blocks-localization';

// Mock IndexedDB cache for tests (jsdom has no IndexedDB)
class FakeIndexedDbCache {
  private store = new Map<string, { data: Record<string, string>; timestamp: number }>();

  async get(key: string, ttl: number) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (ttl > 0 && Date.now() - entry.timestamp >= ttl) return null;
    return entry.data;
  }
  async getStale(key: string) { return this.store.get(key)?.data ?? null; }
  async set(key: string, data: Record<string, string>) {
    this.store.set(key, { data, timestamp: Date.now() });
  }
  async clear() { this.store.clear(); }
}

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: BLOCKS_LOCALIZATION_CONFIG, useValue: { /* config */ } },
      { provide: UilmIndexedDbCache, useValue: new FakeIndexedDbCache() },
    ],
  });
});
```

### Running the library's own tests

```bash
npx nx test blocks-localization
```

### Test suite overview

| Spec file | Tests | What it covers |
|---|---|---|
| `flatten-json.spec.ts` | 9 | Nesting depth, custom separators, null/array edge cases, parent key prefix |
| `lang-codes.spec.ts` | 8 | Short-to-full mapping, full-to-short extraction, reverse mapping |
| `i18n-record.spec.ts` | 2 | Empty record creation from language array |
| `uilm-store.spec.ts` | 14 | Translation lookup, `{{ param }}` interpolation, merge (not overwrite), `has()`, `ready()` signal, version bumping, localStorage persistence + restore, invalid lang fallback |
| `uilm-indexeddb-cache.spec.ts` | 7 | Graceful degradation when IndexedDB unavailable (no throws), TTL expiry logic unit tests |
| `uilm-loader.spec.ts` | 17 | L1 cache hit, L2 (IndexedDB) hit/miss/stale, in-flight dedup, key prefixing (module/alias/empty), full locale in URL, metadata fetch + no-op, clearCache L1+L2, fallbackToLocal disabled, Authorization header, local JSON fallback + flatten |
| `uilm-translate.service.spec.ts` | 8 | `t()` signal, `translate()` sync, `tMany()` / `translateMany()` batch, interpolation, `activeLang`, `setActiveLang()` |
| `provide-blocks-localization-testing.spec.ts` | 4 | Translation injection, default lang, config overrides, empty translations |

### Test infrastructure

| File | Purpose |
|---|---|
| `vite.config.mts` | Vitest configuration (jsdom environment, Angular plugin) |
| `tsconfig.spec.json` | TypeScript config for test files |
| `src/test-setup.ts` | Angular compiler + TestBed initialization |
| `project.json` | Nx `test` target (`@nx/vitest:test` executor) |

---

## Further reading

| Document | What it covers |
|----------|---------------|
| **[DEPLOYMENT.md](./DEPLOYMENT.md)** | CI/CD pipeline, npm publishing, versioning, troubleshooting |
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | Development workflow, code standards, PR process |
| **[CHANGELOG.md](./CHANGELOG.md)** | Version history and release notes |
