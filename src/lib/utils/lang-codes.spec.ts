import { buildReverseMapping, toFullLangCode, toShortLangCode } from './lang-codes';

describe('toFullLangCode', () => {
  const mapping = { en: 'en-US', de: 'de-DE' };

  it('should map short code to full locale', () => {
    expect(toFullLangCode('en', mapping)).toBe('en-US');
  });

  it('should return original if already a full code', () => {
    expect(toFullLangCode('fr-FR', mapping)).toBe('fr-FR');
  });

  it('should return original if no mapping exists', () => {
    expect(toFullLangCode('ja', mapping)).toBe('ja');
  });

  it('should handle empty mapping', () => {
    expect(toFullLangCode('en', {})).toBe('en');
  });
});

describe('toShortLangCode', () => {
  it('should extract short code from full locale', () => {
    expect(toShortLangCode('en-US')).toBe('en');
  });

  it('should return as-is if already short', () => {
    expect(toShortLangCode('en')).toBe('en');
  });
});

describe('buildReverseMapping', () => {
  it('should invert short→full to full→short', () => {
    const result = buildReverseMapping({ en: 'en-US', de: 'de-DE' });
    expect(result).toEqual({ 'en-US': 'en', 'de-DE': 'de' });
  });

  it('should handle empty input', () => {
    expect(buildReverseMapping({})).toEqual({});
  });
});
