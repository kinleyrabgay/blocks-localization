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

export interface UilmScopeConfig {
  /**
   * UILM modules to load for this route.
   *
   * Each entry can be:
   * - A plain string (module name, used as-is for prefixing)
   * - An object `{ module: string, alias?: string }` to remap the prefix
   *
   * @example
   * ```typescript
   * provideUilmScope({
   *   modules: [
   *     'dashboard',
   *     { module: 'opportunity', alias: 'op' },
   *     { module: 'backend', alias: 'be' },
   *   ],
   * })
   * ```
   */
  modules: UilmModuleEntry[];
}

function normalizeEntries(modules: UilmModuleEntry[]): Array<{ module: string; alias?: string }> {
  return modules.map((m) => (typeof m === 'string' ? { module: m } : m));
}

/**
 * Route-level provider that lazily loads specific UILM modules on navigation.
 *
 * In `'eager'` strategy mode, translations are typically already cached
 * from the initial `APP_INITIALIZER` load. The loader's cache deduplication
 * ensures no redundant HTTP calls are made.
 *
 * Re-fetches automatically when the active language changes.
 * Subscriptions are auto-cleaned via `DestroyRef`.
 *
 * @publicApi
 */
export function provideUilmScope(config: UilmScopeConfig) {
  const entries = normalizeEntries(config.modules);

  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => {
      const loader = inject(UilmLoader);
      const store = inject(UilmStore);
      const destroyRef = inject(DestroyRef);
      const globalConfig = inject<BlocksLocalizationConfig>(BLOCKS_LOCALIZATION_CONFIG);

      const loadForLang = (lang: string): void => {
        if (entries.length === 0) return;

        const requests = entries.map((e) =>
          loader.fetchModuleTranslations(lang, e.module, e.alias),
        );

        forkJoin(requests)
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe((results) => {
            const merged = Object.assign({}, ...results);
            store.setTranslation(merged, lang);
          });
      };

      // In eager mode, skip the initial fetch — APP_INITIALIZER already loaded everything.
      // The loader cache will short-circuit anyway, but this avoids unnecessary forkJoin overhead.
      if (globalConfig.strategy !== 'eager') {
        loader
          .ensureMetadataLoaded()
          .pipe(takeUntilDestroyed(destroyRef))
          .subscribe(() => loadForLang(store.activeLang()));
      }

      // Re-load when language changes (always needed — even in eager mode)
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
  ]);
}
