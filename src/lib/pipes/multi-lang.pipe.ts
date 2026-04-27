import { inject, Pipe, PipeTransform } from '@angular/core';

import { UilmStore } from '../uilm-store';

/**
 * Resolves a multilingual object to the value matching the current active language.
 *
 * @example
 * ```html
 * <!-- Given: { en: 'Hello', de: 'Hallo', fr: 'Bonjour' } -->
 * {{ item.name | multiLang }}  <!-- outputs 'Hello' when lang is 'en' -->
 * ```
 */
@Pipe({
  name: 'multiLang',
  standalone: true,
  pure: false,
})
export class MultiLangPipe implements PipeTransform {
  private readonly store = inject(UilmStore);

  transform(value: Record<string, string> | string | null | undefined): string {
    if (!value || typeof value === 'string') {
      return (value as string) ?? '';
    }
    const lang = this.store.activeLang();
    const defaultLang = this.store.getAvailableLangs()[0];
    return value[lang] ?? (defaultLang ? value[defaultLang] : '') ?? '';
  }
}
