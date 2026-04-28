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
  _visited = new Set<object>(),
): Record<string, string> {
  _visited.add(obj);
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = parentKey ? `${parentKey}${separator}${key}` : key;

    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      if (_visited.has(value as object)) continue; // skip circular refs
      _visited.add(value as object);
      Object.assign(
        result,
        flattenJson(value as Record<string, unknown>, newKey, separator, _visited),
      );
    } else if (Array.isArray(value)) {
      if (_visited.has(value)) continue; // skip circular refs
      _visited.add(value);
      value.forEach((item, i) => {
        const arrKey = `${newKey}${separator}${i}`;
        if (item != null && typeof item === 'object' && !Array.isArray(item)) {
          if (_visited.has(item as object)) return;
          _visited.add(item as object);
          Object.assign(
            result,
            flattenJson(item as Record<string, unknown>, arrKey, separator, _visited),
          );
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
