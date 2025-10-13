import { describe, it, expect } from 'vitest';
import { getValueFromPath, pathExists, getValueOr } from '../../src/utils/ObjectAccess';

describe('ObjectAccess - getValueFromPath', () => {
  describe('Basic Access', () => {
    it('should get simple property', () => {
      const obj = { name: 'John', age: 30 };
      const result = getValueFromPath(obj, ['name']);

      expect(result.found).toBe(true);
      expect(result.value).toBe('John');
      expect(result.validPath).toEqual(['name']);
    });

    it('should get nested property', () => {
      const obj = { user: { name: 'John', address: { city: 'Berlin' } } };
      const result = getValueFromPath(obj, ['user', 'address', 'city']);

      expect(result.found).toBe(true);
      expect(result.value).toBe('Berlin');
      expect(result.validPath).toEqual(['user', 'address', 'city']);
    });

    it('should return object itself for empty path', () => {
      const obj = { name: 'John' };
      const result = getValueFromPath(obj, []);

      expect(result.found).toBe(true);
      expect(result.value).toBe(obj);
      expect(result.validPath).toEqual([]);
    });
  });

  describe('Array Access', () => {
    it('should access array element by index', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const result = getValueFromPath(obj, ['items', 1]);

      expect(result.found).toBe(true);
      expect(result.value).toBe('b');
      expect(result.validPath).toEqual(['items', 1]);
    });

    it('should access nested array element', () => {
      const obj = { data: { stations: [{ name: 'Berlin' }, { name: 'Munich' }] } };
      const result = getValueFromPath(obj, ['data', 'stations', 1, 'name']);

      expect(result.found).toBe(true);
      expect(result.value).toBe('Munich');
      expect(result.validPath).toEqual(['data', 'stations', 1, 'name']);
    });

    it('should handle string index for arrays', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const result = getValueFromPath(obj, ['items', '2']);

      expect(result.found).toBe(true);
      expect(result.value).toBe('c');
      expect(result.validPath).toEqual(['items', 2]);
    });

    it('should fail on array index out of bounds', () => {
      const obj = { items: ['a', 'b'] };
      const result = getValueFromPath(obj, ['items', 5]);

      expect(result.found).toBe(false);
      expect(result.error).toContain('out of bounds');
      expect(result.validPath).toEqual(['items']);
    });

    it('should fail on negative array index', () => {
      const obj = { items: ['a', 'b'] };
      const result = getValueFromPath(obj, ['items', -1]);

      expect(result.found).toBe(false);
      expect(result.error).toContain('out of bounds');
    });

    it('should fail on non-numeric array index', () => {
      const obj = { items: ['a', 'b'] };
      const result = getValueFromPath(obj, ['items', 'invalid']);

      expect(result.found).toBe(false);
      expect(result.error).toContain('must be a number');
    });
  });

  describe('Error Cases', () => {
    it('should fail on non-existent property', () => {
      const obj = { name: 'John' };
      const result = getValueFromPath(obj, ['missing']);

      expect(result.found).toBe(false);
      expect(result.error).toContain('does not exist');
      expect(result.validPath).toEqual([]);
    });

    it('should fail on nested non-existent property', () => {
      const obj = { user: { name: 'John' } };
      const result = getValueFromPath(obj, ['user', 'age']);

      expect(result.found).toBe(false);
      expect(result.error).toContain('does not exist');
      expect(result.validPath).toEqual(['user']);
    });

    it('should fail when accessing property of null', () => {
      const obj = { user: null };
      const result = getValueFromPath(obj, ['user', 'name']);

      expect(result.found).toBe(false);
      expect(result.error).toContain('Cannot read property');
      expect(result.validPath).toEqual(['user']);
    });

    it('should fail when accessing property of undefined', () => {
      const obj = { user: undefined };
      const result = getValueFromPath(obj, ['user', 'name']);

      expect(result.found).toBe(false);
      expect(result.error).toContain('Cannot read property');
      expect(result.validPath).toEqual(['user']);
    });

    it('should fail when accessing property of primitive', () => {
      const obj = { value: 42 };
      const result = getValueFromPath(obj, ['value', 'nested']);

      expect(result.found).toBe(false);
      expect(result.error).toContain('primitive type');
      expect(result.validPath).toEqual(['value']);
    });
  });

  describe('Special Values', () => {
    it('should handle null value', () => {
      const obj = { value: null };
      const result = getValueFromPath(obj, ['value']);

      expect(result.found).toBe(true);
      expect(result.value).toBe(null);
    });

    it('should handle undefined value', () => {
      const obj = { value: undefined };
      const result = getValueFromPath(obj, ['value']);

      expect(result.found).toBe(true);
      expect(result.value).toBe(undefined);
    });

    it('should handle boolean values', () => {
      const obj = { flag: false };
      const result = getValueFromPath(obj, ['flag']);

      expect(result.found).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should handle number zero', () => {
      const obj = { count: 0 };
      const result = getValueFromPath(obj, ['count']);

      expect(result.found).toBe(true);
      expect(result.value).toBe(0);
    });

    it('should handle empty string', () => {
      const obj = { text: '' };
      const result = getValueFromPath(obj, ['text']);

      expect(result.found).toBe(true);
      expect(result.value).toBe('');
    });

    it('should handle empty array', () => {
      const obj = { items: [] };
      const result = getValueFromPath(obj, ['items']);

      expect(result.found).toBe(true);
      expect(result.value).toEqual([]);
    });

    it('should handle empty object', () => {
      const obj = { nested: {} };
      const result = getValueFromPath(obj, ['nested']);

      expect(result.found).toBe(true);
      expect(result.value).toEqual({});
    });
  });
});

describe('ObjectAccess - pathExists', () => {
  it('should return true for existing path', () => {
    const obj = { user: { name: 'John' } };
    expect(pathExists(obj, ['user', 'name'])).toBe(true);
  });

  it('should return false for non-existing path', () => {
    const obj = { user: { name: 'John' } };
    expect(pathExists(obj, ['user', 'age'])).toBe(false);
  });

  it('should return false for undefined value', () => {
    const obj = { value: undefined };
    expect(pathExists(obj, ['value'])).toBe(false);
  });

  it('should return true for null value', () => {
    const obj = { value: null };
    expect(pathExists(obj, ['value'])).toBe(true);
  });

  it('should return true for zero', () => {
    const obj = { count: 0 };
    expect(pathExists(obj, ['count'])).toBe(true);
  });

  it('should return true for false', () => {
    const obj = { flag: false };
    expect(pathExists(obj, ['flag'])).toBe(true);
  });

  it('should return true for empty string', () => {
    const obj = { text: '' };
    expect(pathExists(obj, ['text'])).toBe(true);
  });

  it('should return true for empty array', () => {
    const obj = { items: [] };
    expect(pathExists(obj, ['items'])).toBe(true);
  });
});

describe('ObjectAccess - getValueOr', () => {
  it('should return value if path exists', () => {
    const obj = { name: 'John' };
    expect(getValueOr(obj, ['name'], 'default')).toBe('John');
  });

  it('should return default if path does not exist', () => {
    const obj = { name: 'John' };
    expect(getValueOr(obj, ['age'], 30)).toBe(30);
  });

  it('should return default for undefined value', () => {
    const obj = { value: undefined };
    expect(getValueOr(obj, ['value'], 'default')).toBe('default');
  });

  it('should return null value (not default)', () => {
    const obj = { value: null };
    expect(getValueOr(obj, ['value'], 'default')).toBe(null);
  });

  it('should return zero (not default)', () => {
    const obj = { count: 0 };
    expect(getValueOr(obj, ['count'], 10)).toBe(0);
  });

  it('should return false (not default)', () => {
    const obj = { flag: false };
    expect(getValueOr(obj, ['flag'], true)).toBe(false);
  });

  it('should return empty string (not default)', () => {
    const obj = { text: '' };
    expect(getValueOr(obj, ['text'], 'default')).toBe('');
  });

  it('should work with complex default value', () => {
    const obj = { data: {} };
    const defaultValue = { name: 'Unknown', age: 0 };
    expect(getValueOr(obj, ['data', 'user'], defaultValue)).toEqual(defaultValue);
  });
});
