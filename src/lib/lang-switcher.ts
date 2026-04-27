import { inject, Injectable, Signal } from '@angular/core';
import { Observable } from 'rxjs';

import { UilmLanguage } from './types';
import { UilmLoader } from './uilm-loader';
import { UilmStore } from './uilm-store';

/**
 * Headless language switching service.
 * Provides programmatic control over the active language.
 */
@Injectable({ providedIn: 'root' })
export class BlocksLangSwitcher {
  private readonly store = inject(UilmStore);
  private readonly loader = inject(UilmLoader);

  /** Active language as a signal. */
  readonly activeLang: Signal<string> = this.store.activeLang;

  /** Get the currently active short language code. */
  getActiveLang(): string {
    return this.store.activeLang();
  }

  /** Get the list of configured available language codes. */
  getAvailableLangs(): string[] {
    return this.store.getAvailableLangs();
  }

  /**
   * Switch the active language.
   * @param lang Short language code (e.g. 'en', 'de')
   * @param reload Whether to reload the page after switching. Default: false
   */
  setActiveLang(lang: string, reload = false): void {
    this.store.setActiveLang(lang);
    if (reload && typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  /** Fetch available languages from the UILM API. */
  getAvailableLanguagesFromApi(): Observable<UilmLanguage[]> {
    return this.loader.getAvailableLanguages();
  }

  /** Clear the translation cache. */
  clearCache(): void {
    this.loader.clearCache();
  }
}
