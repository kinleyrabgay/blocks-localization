import { inject, Pipe, PipeTransform } from '@angular/core';

import { UilmStore } from '../uilm-store';

/**
 * Impure pipe that translates a key using the UILM store.
 * Re-evaluates when the active language or translations change.
 *
 * @example
 * ```html
 * <p>{{ 'dashboard.LABEL.TITLE' | uilmTranslate }}</p>
 * <p>{{ 'LABEL.HELLO' | uilmTranslate: { name: userName } }}</p>
 * ```
 */
@Pipe({
  name: 'uilmTranslate',
  standalone: true,
  pure: false,
})
export class UilmTranslatePipe implements PipeTransform {
  private readonly store = inject(UilmStore);

  private lastKey = '';
  private lastLang = '';
  private lastVersion = -1;
  private lastParamsJson = '';
  private lastValue = '';

  transform(key: string, params?: Record<string, unknown>): string {
    const lang = this.store.activeLang();
    const version = this.store.version();

    if (!this.store.ready()) {
      return '';
    }

    const paramsJson = params ? JSON.stringify(params) : '';
    if (
      key === this.lastKey &&
      lang === this.lastLang &&
      version === this.lastVersion &&
      paramsJson === this.lastParamsJson
    ) {
      return this.lastValue;
    }

    this.lastKey = key;
    this.lastLang = lang;
    this.lastVersion = version;
    this.lastParamsJson = paramsJson;
    this.lastValue = this.store.has(key)
      ? this.store.translate(key, params)
      : key;
    return this.lastValue;
  }
}
