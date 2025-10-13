import { describe, it, expect } from 'vitest';
import { filterFiles } from '../../src';
import type { JsonFile, MatchRule } from '../../src';

describe('Edge Cases', () => {
  describe('Empty and Null Values', () => {
    it('should handle file with empty data object', () => {
      const files: JsonFile[] = [{ fileName: 'empty.json', data: {} }];

      const rules: MatchRule[] = [
        { match: [{ path: ['missing'], check: { exists: false } }], expected: 'empty' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should handle file with null data', () => {
      const files: JsonFile[] = [{ fileName: 'null.json', data: null }];

      const rules: MatchRule[] = [
        { match: [{ path: ['any'], check: { exists: false } }], expected: 'null' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should match empty string values', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { text: '' } }];

      const rules: MatchRule[] = [
        { match: [{ path: ['text'], check: { value: '' } }], expected: 'empty-text' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should match zero values', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { count: 0 } }];

      const rules: MatchRule[] = [
        { match: [{ path: ['count'], check: { value: 0 } }], expected: 'zero' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should match false values', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { flag: false } }];

      const rules: MatchRule[] = [
        { match: [{ path: ['flag'], check: { value: false } }], expected: 'false' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should handle empty arrays', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { items: [] } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['items'], check: { type: 'equal', size: 0 } }],
          expected: 'empty-array',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });
  });

  describe('Deeply Nested Structures', () => {
    it('should handle deeply nested objects', () => {
      const files: JsonFile[] = [
        {
          fileName: 'deep.json',
          data: {
            level1: {
              level2: {
                level3: {
                  level4: {
                    level5: {
                      value: 'deep',
                    },
                  },
                },
              },
            },
          },
        },
      ];

      const rules: MatchRule[] = [
        {
          match: [
            {
              path: ['level1', 'level2', 'level3', 'level4', 'level5', 'value'],
              check: { value: 'deep' },
            },
          ],
          expected: 'deep',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should handle deeply nested arrays', () => {
      const files: JsonFile[] = [
        {
          fileName: 'nested-arrays.json',
          data: {
            matrix: [
              [
                [1, 2],
                [3, 4],
              ],
              [
                [5, 6],
                [7, 8],
              ],
            ],
          },
        },
      ];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['matrix', 1, 0, 1], check: { value: 6 } }],
          expected: 'nested',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });
  });

  describe('Large Data Structures', () => {
    it('should handle file with many properties', () => {
      const data: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) {
        data[`prop${i}`] = i;
      }

      const files: JsonFile[] = [{ fileName: 'large.json', data }];

      const rules: MatchRule[] = [
        { match: [{ path: ['prop500'], check: { value: 500 } }], expected: 'large' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should handle large arrays', () => {
      const items = Array.from({ length: 10000 }, (_, i) => i);
      const files: JsonFile[] = [{ fileName: 'big-array.json', data: { items } }];

      const rules: MatchRule[] = [
        { match: [{ path: ['items'], check: { type: 'equal', size: 10000 } }], expected: 'big' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });
  });

  describe('Special Characters', () => {
    it('should handle special characters in property names', () => {
      const files: JsonFile[] = [
        {
          fileName: 'special.json',
          data: {
            'property-with-dash': 'value1',
            'property.with.dots': 'value2',
            'property with spaces': 'value3',
          },
        },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['property-with-dash'], check: { value: 'value1' } }], expected: 'dash' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should handle unicode characters', () => {
      const files: JsonFile[] = [
        {
          fileName: 'unicode.json',
          data: { name: '日本語', emoji: '🎉', special: 'Ü' },
        },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['name'], check: { value: '日本語' } }], expected: 'unicode' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });
  });

  describe('Complex Matching Scenarios', () => {
    it('should handle all files matching wildcard', () => {
      const files: JsonFile[] = [
        { fileName: 'opt1.json', data: { type: 'optional' } },
        { fileName: 'opt2.json', data: { type: 'optional' } },
        { fileName: 'opt3.json', data: { type: 'optional' } },
      ];

      const rules: MatchRule[] = [
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          optional: true,
          greedy: true,
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.wildcardMatched).toHaveLength(3);
      expect(result.unmapped).toHaveLength(0);
    });

    it('should handle no files matching any rule', () => {
      const files: JsonFile[] = [
        { fileName: 'unknown1.json', data: { type: 'unknown1' } },
        { fileName: 'unknown2.json', data: { type: 'unknown2' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'expected' } }], expected: 'expected' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(0);
      expect(result.unmapped).toHaveLength(2);
    });

    it('should handle multiple wildcards', () => {
      const files: JsonFile[] = [
        { fileName: 'event1.json', data: { type: 'event1' } },
        { fileName: 'opt1.json', data: { category: 'optional' } },
        { fileName: 'event2.json', data: { type: 'event2' } },
        { fileName: 'debug1.json', data: { category: 'debug' } },
        { fileName: 'event3.json', data: { type: 'event3' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          matchAny: [{ path: ['category'], check: { value: 'optional' } }],
          optional: true,
          greedy: true,
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
        {
          matchAny: [{ path: ['category'], check: { value: 'debug' } }],
          optional: true,
          greedy: true,
        },
        { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(3); // event1, event2, event3
      expect(result.wildcardMatched).toHaveLength(2); // opt1, debug1
    });

    it('should handle interleaved mandatory and optional rules', () => {
      const files: JsonFile[] = [
        { fileName: 'event1.json', data: { type: 'event1' } },
        { fileName: 'event2.json', data: { type: 'event2' } },
        { fileName: 'event3.json', data: { type: 'event3' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          match: [{ path: ['type'], check: { value: 'missing' } }],
          expected: 'missing',
          optional: true,
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
        {
          match: [{ path: ['type'], check: { value: 'missing2' } }],
          expected: 'missing2',
          optional: true,
        },
        { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(3);
      expect(result.unmapped).toHaveLength(0);
    });
  });

  describe('Mixed Data Types', () => {
    it('should handle arrays containing different types', () => {
      const files: JsonFile[] = [
        {
          fileName: 'mixed.json',
          data: {
            items: [1, 'two', { three: 3 }, [4], true, null],
          },
        },
      ];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['items'], check: { itemExists: true, item: 'two' } }],
          expected: 'has-string',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should handle objects with mixed value types', () => {
      const files: JsonFile[] = [
        {
          fileName: 'mixed.json',
          data: {
            string: 'text',
            number: 42,
            boolean: true,
            null: null,
            array: [1, 2, 3],
            object: { nested: 'value' },
          },
        },
      ];

      const rules: MatchRule[] = [
        {
          match: [
            { path: ['string'], check: { exists: true } },
            { path: ['number'], check: { exists: true } },
            { path: ['boolean'], check: { exists: true } },
            { path: ['array'], check: { exists: true } },
            { path: ['object'], check: { exists: true } },
          ],
          expected: 'mixed',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });
  });

  describe('Duplicate Files', () => {
    it('should handle files with identical data', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event' } },
        { fileName: 'file2.json', data: { type: 'event' } },
        { fileName: 'file3.json', data: { type: 'event' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event' } }], expected: 'event1' },
        { match: [{ path: ['type'], check: { value: 'event' } }], expected: 'event2' },
        { match: [{ path: ['type'], check: { value: 'event' } }], expected: 'event3' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(3);
      expect(result.unmapped).toHaveLength(0);
    });
  });

  describe('Metadata', () => {
    it('should preserve file metadata', () => {
      const files: JsonFile[] = [
        {
          fileName: 'file.json',
          data: { type: 'event' },
          metadata: { timestamp: '2023-11-08', source: 'test' },
        },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event' } }], expected: 'event' },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped[0].file.metadata).toEqual({ timestamp: '2023-11-08', source: 'test' });
    });

    it('should preserve rule info in results', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { type: 'event' } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['type'], check: { value: 'event' } }],
          expected: 'event',
          info: { description: 'Test event', category: 'testing' },
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped[0].info).toEqual({ description: 'Test event', category: 'testing' });
    });
  });
});
