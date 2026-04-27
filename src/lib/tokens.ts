import { InjectionToken } from '@angular/core';

import { BlocksLocalizationConfig } from './types';

/**
 * Injection token for the blocks-localization configuration.
 * Provided by `provideBlocksLocalization()` at the application root.
 */
export const BLOCKS_LOCALIZATION_CONFIG = new InjectionToken<BlocksLocalizationConfig>(
  'BlocksLocalizationConfig',
);
