import { createI18nRecord } from './i18n-record';

describe('createI18nRecord', () => {
  it('should create empty record with language keys', () => {
    expect(createI18nRecord(['en', 'de', 'fr'])).toEqual({ en: '', de: '', fr: '' });
  });

  it('should return empty object for empty array', () => {
    expect(createI18nRecord([])).toEqual({});
  });
});
