import { describe, it, expect } from 'vitest';
import { filterFiles, FilterEngine } from '../../src';
import type { JsonFile, MatchRule, FilterCriterion } from '../../src';

describe('Error Handling', () => {
  describe('Invalid Paths', () => {
    it('should handle accessing non-existent nested paths', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { user: { name: 'John' } } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['user', 'address', 'city'], check: { value: 'Berlin' } }],
          expected: 'berlin-user',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
      expect(result.mapped).toHaveLength(0);
    });

    it('should handle accessing properties of primitives', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { value: 42 } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['value', 'nested'], check: { value: 'something' } }],
          expected: 'nested',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });

    it('should handle accessing properties of null', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { value: null } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['value', 'nested'], check: { value: 'something' } }],
          expected: 'nested',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });

    it('should handle accessing properties of undefined', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { value: undefined } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['value', 'nested'], check: { value: 'something' } }],
          expected: 'nested',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });
  });

  describe('Invalid Array Access', () => {
    it('should handle out of bounds array access', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { items: [1, 2, 3] } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['items', 10], check: { value: 'something' } }],
          expected: 'out-of-bounds',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });

    it('should handle negative array index', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { items: [1, 2, 3] } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['items', -1], check: { value: 3 } }],
          expected: 'negative-index',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });

    it('should handle non-numeric array index', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { items: [1, 2, 3] } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['items', 'invalid'], check: { value: 1 } }],
          expected: 'invalid-index',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });
  });

  describe('Type Mismatches', () => {
    it('should handle array check on non-array', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { items: 'not-an-array' } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['items'], check: { type: 'equal', size: 3 } }],
          expected: 'array-check',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });

    it('should handle array element check on non-array', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { items: 'not-an-array' } }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['items'], check: { itemExists: true, item: 'value' } }],
          expected: 'element-check',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });

    it('should handle time range check on invalid timestamp', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { timestamp: 'invalid-date' } }];

      const rules: MatchRule[] = [
        {
          match: [
            {
              path: ['timestamp'],
              check: {
                min: '2023-11-08T15:00:00+01:00',
                max: '2023-11-08T16:00:00+01:00',
              },
            },
          ],
          expected: 'time-check',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });

    it('should handle time range check on object', () => {
      const files: JsonFile[] = [
        { fileName: 'file.json', data: { timestamp: { date: '2023-11-08' } } },
      ];

      const rules: MatchRule[] = [
        {
          match: [
            {
              path: ['timestamp'],
              check: {
                min: '2023-11-08T15:00:00+01:00',
                max: '2023-11-08T16:00:00+01:00',
              },
            },
          ],
          expected: 'time-check',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });
  });

  describe('Invalid Time Ranges', () => {
    const engine = new FilterEngine();

    it('should handle invalid min/max in time range', () => {
      const data = { timestamp: 1699452600000 };
      const criterion: FilterCriterion = {
        path: ['timestamp'],
        check: {
          min: 'invalid',
          max: 'invalid',
        },
      };

      const result = engine.evaluateCriterion(data, criterion);
      expect(result.status).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should handle invalid ISO timestamp in check', () => {
      const data = { timestamp: '2023-11-08T15:30:00+01:00' };
      const criterion: FilterCriterion = {
        path: ['timestamp'],
        check: {
          min: 'not-a-date',
          max: 'not-a-date',
        },
      };

      const result = engine.evaluateCriterion(data, criterion);
      expect(result.status).toBe(false);
    });
  });

  describe('Malformed Data', () => {
    it('should handle circular references (should not crash)', () => {
      const circular: any = { name: 'circular' }; // eslint-disable-line @typescript-eslint/no-explicit-any
      circular.self = circular;

      const files: JsonFile[] = [{ fileName: 'circular.json', data: circular }];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['name'], check: { value: 'circular' } }],
          expected: 'circular',
        },
      ];

      // This should not crash - it should just match on 'name'
      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });

    it('should handle very deeply nested paths that do not exist', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { a: {} } }];

      const longPath = Array.from({ length: 100 }, (_, i) => `level${i}`);
      const rules: MatchRule[] = [
        {
          match: [{ path: longPath, check: { value: 'something' } }],
          expected: 'deep',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
    });
  });

  describe('Empty Criteria', () => {
    it('should match file with empty criteria array', () => {
      const files: JsonFile[] = [{ fileName: 'file.json', data: { type: 'event' } }];

      const rules: MatchRule[] = [
        {
          match: [], // No criteria - should match anything
          expected: 'no-criteria',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.mapped).toHaveLength(1);
    });
  });

  describe('Complex Failure Scenarios', () => {
    it('should track multiple failed checks correctly', () => {
      const files: JsonFile[] = [
        {
          fileName: 'file.json',
          data: { type: 'event', status: 'inactive', value: 10 },
        },
      ];

      const rules: MatchRule[] = [
        {
          match: [
            { path: ['type'], check: { value: 'event' } }, // Should pass
            { path: ['status'], check: { value: 'active' } }, // Should fail
            { path: ['value'], check: { value: 100 } }, // Should fail
          ],
          expected: 'multi-check',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);
      expect(result.unmapped[0].attemptedRules).toHaveLength(1);

      const attemptedRule = result.unmapped[0].attemptedRules[0];
      expect(attemptedRule.matched).toBe(false);
      expect(attemptedRule.checks).toHaveLength(3);
      expect(attemptedRule.checks[0].status).toBe(true);
      expect(attemptedRule.checks[1].status).toBe(false);
      expect(attemptedRule.checks[2].status).toBe(false);
    });

    it('should provide detailed error information', () => {
      const files: JsonFile[] = [
        {
          fileName: 'file.json',
          data: { user: { name: 'John' } },
        },
      ];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['user', 'missing'], check: { value: 'something' } }],
          expected: 'has-field',
        },
      ];

      const result = filterFiles({ files, rules });
      expect(result.unmapped).toHaveLength(1);

      const attemptedRule = result.unmapped[0].attemptedRules[0];
      expect(attemptedRule.checks[0].status).toBe(false);
      expect(attemptedRule.checks[0].reason).toBeDefined();
    });
  });

  describe('Robust Against Invalid Input', () => {
    it('should handle files array with mixed valid and invalid entries', () => {
      const files = [
        { fileName: 'valid.json', data: { type: 'event' } },
        // Note: These would be invalid in TypeScript but we test runtime behavior
        { fileName: 'no-data.json' } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      ] as JsonFile[];

      const rules: MatchRule[] = [
        {
          match: [{ path: ['type'], check: { value: 'event' } }],
          expected: 'event',
        },
      ];

      // Should handle gracefully without crashing
      const result = filterFiles({ files, rules });
      expect(result.mapped.length + result.unmapped.length).toBeLessThanOrEqual(files.length);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle many files with many rules efficiently', () => {
      const files: JsonFile[] = Array.from({ length: 100 }, (_, i) => ({
        fileName: `file${i}.json`,
        data: { id: i, type: `event${i % 10}` },
      }));

      const rules: MatchRule[] = Array.from({ length: 10 }, (_, i) => ({
        match: [{ path: ['type'], check: { value: `event${i}` } }],
        expected: `event${i}`,
      }));

      const startTime = Date.now();
      const result = filterFiles({ files, rules });
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
      expect(result.mapped.length).toBeGreaterThan(0);
    });

    it('should handle many criteria per rule efficiently', () => {
      const data: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        data[`field${i}`] = i;
      }

      const files: JsonFile[] = [{ fileName: 'many-fields.json', data }];

      const criteria = Array.from({ length: 100 }, (_, i) => ({
        path: [`field${i}`],
        check: { value: i },
      }));

      const rules: MatchRule[] = [
        {
          match: criteria,
          expected: 'all-fields',
        },
      ];

      const startTime = Date.now();
      const result = filterFiles({ files, rules });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(result.mapped).toHaveLength(1);
    });
  });
});
