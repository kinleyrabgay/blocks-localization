/**
 * Flattens a nested object into dot-notation keys.
 *
 * @example
 * ```typescript
 * flattenJson({ LABEL: { HELLO: 'Hello', WORLD: 'World' }, BTN: { SAVE: 'Save' } })
 * // → { 'LABEL.HELLO': 'Hello', 'LABEL.WORLD': 'World', 'BTN.SAVE': 'Save' }
 * ```
 */
export function flattenJson(
  obj: Record<string, unknown>,
  parentKey = '',
  separator = '.',
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = parentKey ? `${parentKey}${separator}${key}` : key;

    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value as Record<string, unknown>, newKey, separator));
    } else if (Array.isArray(value)) {
      // Recurse into array items with numeric indices
      value.forEach((item, i) => {
        const arrKey = `${newKey}${separator}${i}`;
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          Object.assign(result, flattenJson(item as Record<string, unknown>, arrKey, separator));
        } else {
          result[arrKey] = String(item ?? '');
        }
      });
    } else {
      result[newKey] = String(value ?? '');
    }
  }

  return result;
}
