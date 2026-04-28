import { flattenJson } from './flatten-json';

describe('flattenJson', () => {
  it('should flatten nested objects to dot-notation keys', () => {
    const result = flattenJson({ LABEL: { HELLO: 'Hello', WORLD: 'World' } });
    expect(result).toEqual({ 'LABEL.HELLO': 'Hello', 'LABEL.WORLD': 'World' });
  });

  it('should return flat objects unchanged', () => {
    const result = flattenJson({ KEY: 'value' });
    expect(result).toEqual({ KEY: 'value' });
  });

  it('should handle deeply nested objects', () => {
    const result = flattenJson({ A: { B: { C: 'deep' } } });
    expect(result).toEqual({ 'A.B.C': 'deep' });
  });

  it('should handle empty objects', () => {
    expect(flattenJson({})).toEqual({});
  });

  it('should convert non-string values to strings', () => {
    const result = flattenJson({ NUM: 42, BOOL: true } as Record<string, unknown>);
    expect(result).toEqual({ NUM: '42', BOOL: 'true' });
  });

  it('should handle null values as empty string', () => {
    const result = flattenJson({ KEY: null } as Record<string, unknown>);
    expect(result).toEqual({ KEY: '' });
  });

  it('should support a custom separator', () => {
    const result = flattenJson({ A: { B: 'val' } }, '', '/');
    expect(result).toEqual({ 'A/B': 'val' });
  });

  it('should respect a parent key prefix', () => {
    const result = flattenJson({ KEY: 'val' }, 'PREFIX');
    expect(result).toEqual({ 'PREFIX.KEY': 'val' });
  });

  it('should flatten arrays with numeric indices', () => {
    const result = flattenJson({ ARR: [1, 2] } as Record<string, unknown>);
    expect(result).toEqual({ 'ARR.0': '1', 'ARR.1': '2' });
  });

  it('should handle null values inside arrays', () => {
    const result = flattenJson({ ARR: [null, 'hello'] } as Record<string, unknown>);
    expect(result).toEqual({ 'ARR.0': '', 'ARR.1': 'hello' });
  });

  it('should flatten arrays containing objects', () => {
    const result = flattenJson({
      ITEMS: [{ NAME: 'first' }, { NAME: 'second' }],
    } as Record<string, unknown>);
    expect(result).toEqual({ 'ITEMS.0.NAME': 'first', 'ITEMS.1.NAME': 'second' });
  });

  it('should handle circular references without crashing', () => {
    const obj: Record<string, unknown> = { A: 'hello' };
    obj['SELF'] = obj; // circular ref
    const result = flattenJson(obj);
    expect(result).toEqual({ A: 'hello' });
  });

  it('should handle circular references in nested objects', () => {
    const child: Record<string, unknown> = { B: 'world' };
    const obj: Record<string, unknown> = { A: 'hello', CHILD: child };
    child['PARENT'] = obj; // circular ref back to parent
    const result = flattenJson(obj);
    expect(result).toEqual({ A: 'hello', 'CHILD.B': 'world' });
  });
});
