/**
 * Creates an empty record with keys for each provided language.
 * Useful for initializing multilingual form models.
 *
 * @example
 * createI18nRecord(['en', 'de', 'fr']) // { en: '', de: '', fr: '' }
 */
export function createI18nRecord(langs: string[]): Record<string, string> {
  return langs.reduce<Record<string, string>>((acc, lang) => {
    acc[lang] = '';
    return acc;
  }, {});
}
