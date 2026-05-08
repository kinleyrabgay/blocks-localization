import { ENVIRONMENT_INITIALIZER, inject, makeEnvironmentProviders } from '@angular/core';

import { BLOCKS_LOCALIZATION_CONFIG } from '../lib/tokens';
import { BlocksLocalizationConfig } from '../lib/types';
import { UilmStore } from '../lib/uilm-store';

/**
 * Provides a test-friendly translation setup with in-memory translations.
 * No HTTP calls are made.
 *
 * @example
 * ```typescript
 * TestBed.configureTestingModule({
 *   providers: [
 *     provideBlocksLocalizationTesting({
 *       en: { 'dashboard.LABEL.HELLO': 'Hello', 'dashboard.LABEL.WORLD': 'World' },
 *       de: { 'dashboard.LABEL.HELLO': 'Hallo', 'dashboard.LABEL.WORLD': 'Welt' },
 *     }),
 *   ],
 * });
 * ```
 */
export function provideBlocksLocalizationTesting(
  translations: Record<string, Record<string, string>> = { en: {} },
  config?: Partial<BlocksLocalizationConfig>,
) {
  const langs = Object.keys(translations);
  const defaultLang = config?.defaultLang ?? langs[0] ?? 'en';

  const fullConfig: BlocksLocalizationConfig = {
    uilmApiBaseUrl: '',
    projectKey: '',
    availableLangs: langs,
    defaultLang,
    ...config,
  };

  return makeEnvironmentProviders([
    { provide: BLOCKS_LOCALIZATION_CONFIG, useValue: fullConfig },

    { provide: ENVIRONMENT_INITIALIZER, multi: true, useValue: () => {
      const store = inject(UilmStore);
      for (const [lang, data] of Object.entries(translations)) {
        store.setTranslation(data, lang);
      }
      // Ensure deterministic active language regardless of leftover localStorage
      store.setActiveLang(defaultLang);
    }},
  ]);
}
