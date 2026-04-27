import {
  DestroyRef,
  effect,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { BLOCKS_LOCALIZATION_CONFIG } from './tokens';
import { BlocksLocalizationConfig, UilmModuleEntry } from './types';
import { UilmLoader } from './uilm-loader';
import { UilmStore } from './uilm-store';

/**
 * Build an array of `fetchModuleTranslations` observables from module entries.
 * @internal
 */
function buildRequests(loader: UilmLoader, modules: UilmModuleEntry[], lang: string) {
  return modules.map((m) =>
    typeof m === 'string'
      ? loader.fetchModuleTranslations(lang, m)
      : loader.fetchModuleTranslations(lang, m.module, m.alias),
  );
}

/**
 * Provides all UILM translation infrastructure for an Angular application.
 *
 * ## Strategies
 *
 * ### `'modular'` (default)
 * Preloads only the modules listed in `preloadModules` at startup.
 * Additional modules are lazily loaded per route via `provideUilmScope()`.
 * Shows empty placeholders while translations are loading.
 *
 * ### `'eager'`
 * All modules in `preloadModules` are fetched at startup (non-blocking).
 * Use `UilmLoadingScreenComponent` with `UilmStore.ready` to gate the UI
 * until translations are available. Route-level `provideUilmScope()` calls
 * become cache hits.
 *
 * @example
 * ```typescript
 * // Eager — all modules upfront with loading screen
 * provideBlocksLocalization({
 *   strategy: 'eager',
 *   preloadModules: [
 *     { module: 'common', alias: '' },
 *     'dashboard',
 *     { module: 'opportunity', alias: 'op' },
 *   ],
 *   // ...
 * })
 *
 * // app.component.html
 * // @if (!store.ready()) {
 * //   <uilm-loading-screen />
 * // } @else {
 * //   <router-outlet />
 * // }
 * ```
 *
 * @publicApi
 */
export function provideBlocksLocalization(config: BlocksLocalizationConfig) {
  const modules = config.preloadModules ?? [];

  return makeEnvironmentProviders([
    { provide: BLOCKS_LOCALIZATION_CONFIG, useValue: config },

    // -------------------------------------------------------------------------
    // Preload modules + language-change watcher
    // -------------------------------------------------------------------------
    ...(modules.length
      ? [
          provideEnvironmentInitializer(() => {
            const loader = inject(UilmLoader);
            const store = inject(UilmStore);
            const destroyRef = inject(DestroyRef);

            const loadForLang = (lang: string): void => {
              forkJoin(buildRequests(loader, modules, lang))
                .pipe(takeUntilDestroyed(destroyRef))
                .subscribe((results) => {
                  const merged = Object.assign({}, ...results);
                  store.setTranslation(merged, lang);
                });
            };

            // Load for current language immediately
            loader
              .ensureMetadataLoaded()
              .pipe(takeUntilDestroyed(destroyRef))
              .subscribe(() => loadForLang(store.activeLang()));

            // Re-load when language changes
            let previousLang = store.activeLang();
            effect(() => {
              const newLang = store.activeLang();
              if (newLang !== previousLang) {
                previousLang = newLang;
                loader
                  .ensureMetadataLoaded()
                  .pipe(takeUntilDestroyed(destroyRef))
                  .subscribe(() => loadForLang(newLang));
              }
            });
          }),
        ]
      : []),
  ]);
}
