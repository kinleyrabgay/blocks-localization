import { TestBed } from '@angular/core/testing';

import { UilmStore } from '../lib/uilm-store';
import { provideBlocksLocalizationTesting } from './provide-blocks-localization-testing';

describe('provideBlocksLocalizationTesting', () => {
  it('should provide translations without HTTP', () => {
    TestBed.configureTestingModule({
      providers: [
        provideBlocksLocalizationTesting({
          en: { KEY: 'English' },
          de: { KEY: 'German' },
        }),
      ],
    });

    const store = TestBed.inject(UilmStore);
    expect(store.translate('KEY')).toBe('English');
    expect(store.ready()).toBe(true);
  });

  it('should default to first language key', () => {
    TestBed.configureTestingModule({
      providers: [provideBlocksLocalizationTesting({ fr: { A: 'B' } })],
    });

    const store = TestBed.inject(UilmStore);
    expect(store.activeLang()).toBe('fr');
  });

  it('should respect custom config overrides', () => {
    TestBed.configureTestingModule({
      providers: [provideBlocksLocalizationTesting({ en: {}, de: {} }, { defaultLang: 'de' })],
    });

    const store = TestBed.inject(UilmStore);
    expect(store.activeLang()).toBe('de');
  });

  it('should handle empty translations', () => {
    TestBed.configureTestingModule({
      providers: [provideBlocksLocalizationTesting()],
    });

    const store = TestBed.inject(UilmStore);
    expect(store.activeLang()).toBe('en');
  });

  it('should fall back to "en" as defaultLang when translations object is empty', () => {
    TestBed.configureTestingModule({
      providers: [
        provideBlocksLocalizationTesting({} as Record<string, Record<string, string>>, {
          availableLangs: ['en'],
        }),
      ],
    });

    const store = TestBed.inject(UilmStore);
    expect(store.activeLang()).toBe('en');
  });

  it('should use config override for availableLangs when provided', () => {
    TestBed.configureTestingModule({
      providers: [
        provideBlocksLocalizationTesting(
          { en: { A: '1' }, de: { A: '2' } },
          { availableLangs: ['en'], defaultLang: 'en' },
        ),
      ],
    });

    const store = TestBed.inject(UilmStore);
    // config override limits availableLangs to ['en'] even though 'de' translations exist
    expect(store.getAvailableLangs()).toEqual(['en']);
  });
});
