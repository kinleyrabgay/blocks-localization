import { computed, inject, Injectable, Signal } from '@angular/core';

import { UilmStore } from './uilm-store';

/**
 * Translation service for component classes.
 * Fully signal-based with sync helpers.
 *
 * @example
 * ```typescript
 * private readonly uilm = inject(UilmTranslateService);
 *
 * // Signal-based (reactive, updates on lang change + translation load)
 * title = this.uilm.t('dashboard.LABEL.TITLE');
 * // In template: {{ title() }}
 *
 * // Sync snapshot (does NOT react)
 * label = this.uilm.translate('dashboard.LABEL.TITLE');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class UilmTranslateService {
  private readonly store = inject(UilmStore);

  /** Active language as a signal. */
  readonly activeLang: Signal<string> = this.store.activeLang;

  /**
   * Signal-based translation. Auto-updates on language change
   * and when new translations are loaded.
   */
  t(key: string, params?: Record<string, unknown>): Signal<string> {
    return computed(() => this.store.translate(key, params));
  }

  /** Synchronous translation snapshot. Does NOT react to changes. */
  translate(key: string, params?: Record<string, unknown>): string {
    return this.store.translate(key, params);
  }

  /** Current active language code. */
  getActiveLang(): string {
    return this.store.activeLang();
  }

  /** Set active language. */
  setActiveLang(lang: string): void {
    this.store.setActiveLang(lang);
  }

  /**
   * Signal-based batch translation. Reactive to lang and translation changes.
   */
  tMany(keys: string[], params?: Record<string, unknown>): Signal<Record<string, string>> {
    return computed(() => {
      const result: Record<string, string> = {};
      for (const key of keys) {
        result[key] = this.store.translate(key, params);
      }
      return result;
    });
  }

  /** Synchronous batch translation snapshot. */
  translateMany(keys: string[], params?: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = this.store.translate(key, params);
    }
    return result;
  }
}
