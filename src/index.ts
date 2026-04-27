// ---------------------------------------------------------------------------
// Core configuration
// ---------------------------------------------------------------------------
export { provideBlocksLocalization } from './lib/provide-blocks-localization';
export { BLOCKS_LOCALIZATION_CONFIG } from './lib/tokens';
export type {
  BlocksLocalizationConfig,
  UilmCacheStorage,
  UilmLangStorage,
  UilmLanguage,
  UilmLoadingStrategy,
  UilmModule,
  UilmModuleEntry,
} from './lib/types';

// ---------------------------------------------------------------------------
// Core store & loader
// ---------------------------------------------------------------------------
export { UilmIndexedDbCache } from './lib/uilm-indexeddb-cache';
export { UilmLoader } from './lib/uilm-loader';
export type { TranslationMap } from './lib/uilm-store';
export { UilmStore } from './lib/uilm-store';

// ---------------------------------------------------------------------------
// Route-level lazy module loading
// ---------------------------------------------------------------------------
export type { UilmScopeConfig } from './lib/provide-uilm-scope';
export { provideUilmScope } from './lib/provide-uilm-scope';

// ---------------------------------------------------------------------------
// Language switching
// ---------------------------------------------------------------------------
export { BlocksLangSwitcher } from './lib/lang-switcher';

// ---------------------------------------------------------------------------
// Template tools (directive, pipe, service)
// ---------------------------------------------------------------------------
export { UilmTranslateDirective } from './lib/directives/uilm-translate.directive';
export { MultiLangPipe } from './lib/pipes/multi-lang.pipe';
export { UilmTranslatePipe } from './lib/pipes/uilm-translate.pipe';
export { UilmTranslateService } from './lib/uilm-translate.service';

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------
export { UilmLoadingScreenComponent } from './lib/components/uilm-loading-screen.component';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
export { flattenJson } from './lib/utils/flatten-json';
export { createI18nRecord } from './lib/utils/i18n-record';
export { buildReverseMapping, toFullLangCode, toShortLangCode } from './lib/utils/lang-codes';

// ---------------------------------------------------------------------------
// Testing
// ---------------------------------------------------------------------------
export { provideBlocksLocalizationTesting } from './testing/provide-blocks-localization-testing';
