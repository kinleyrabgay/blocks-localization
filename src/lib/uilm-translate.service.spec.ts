import { TestBed } from '@angular/core/testing';

import { provideBlocksLocalizationTesting } from '../testing/provide-blocks-localization-testing';
import { UilmTranslateService } from './uilm-translate.service';

describe('UilmTranslateService', () => {
  let service: UilmTranslateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideBlocksLocalizationTesting({
          en: { HELLO: 'Hello', GREET: 'Hi {{ name }}' },
          de: { HELLO: 'Hallo', GREET: 'Hallo {{ name }}' },
        }),
      ],
    });
    service = TestBed.inject(UilmTranslateService);
  });

  it('should translate a key synchronously', () => {
    expect(service.translate('HELLO')).toBe('Hello');
  });

  it('should return a reactive signal via t()', () => {
    const sig = service.t('HELLO');
    expect(sig()).toBe('Hello');
  });

  it('should interpolate params', () => {
    expect(service.translate('GREET', { name: 'Alice' })).toBe('Hi Alice');
  });

  it('should batch translate via translateMany', () => {
    const result = service.translateMany(['HELLO', 'GREET'], { name: 'Bob' });
    expect(result).toEqual({ HELLO: 'Hello', GREET: 'Hi Bob' });
  });

  it('should return reactive batch signal via tMany', () => {
    const sig = service.tMany(['HELLO']);
    expect(sig()).toEqual({ HELLO: 'Hello' });
  });

  it('should return current language', () => {
    expect(service.getActiveLang()).toBe('en');
  });

  it('should expose activeLang as signal', () => {
    expect(service.activeLang()).toBe('en');
  });

  it('should switch language', () => {
    service.setActiveLang('de');
    expect(service.getActiveLang()).toBe('de');
    expect(service.translate('HELLO')).toBe('Hallo');
  });
});
