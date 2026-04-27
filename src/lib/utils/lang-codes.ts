/**
 * Convert a short language code to a full locale code using the provided mapping.
 * Returns the original code if no mapping is found or if it's already a full code.
 */
export function toFullLangCode(lang: string, mapping: Record<string, string>): string {
  if (lang.includes('-')) {
    return lang;
  }
  return mapping[lang] || lang;
}

/**
 * Convert a full locale code (e.g. 'en-US') to a short code (e.g. 'en').
 */
export function toShortLangCode(fullCode: string): string {
  return fullCode.split('-')[0];
}

/**
 * Build a reverse mapping from full locale codes to short codes.
 */
export function buildReverseMapping(localeMapping: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(localeMapping).map(([short, full]) => [full, short]));
}
