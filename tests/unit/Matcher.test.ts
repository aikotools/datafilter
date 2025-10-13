import { describe, it, expect } from 'vitest';
import { Matcher } from '../../src/matcher/Matcher';
import type { JsonFile, MatchRule } from '../../src/core/types';

describe('Matcher', () => {
  const matcher = new Matcher();

  describe('matchFile', () => {
    it('should match file with single criterion', () => {
      const file: JsonFile = {
        fileName: 'test.json',
        data: { type: 'event1' },
      };

      const rule: MatchRule = {
        match: [{ path: ['type'], check: { value: 'event1' } }],
        expected: 'event1',
      };

      const result = matcher.matchFile(file, rule);
      expect(result.matched).toBe(true);
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].status).toBe(true);
    });

    it('should match file with multiple criteria (AND logic)', () => {
      const file: JsonFile = {
        fileName: 'test.json',
        data: { type: 'event1', status: 'active', value: 42 },
      };

      const rule: MatchRule = {
        match: [
          { path: ['type'], check: { value: 'event1' } },
          { path: ['status'], check: { value: 'active' } },
          { path: ['value'], check: { value: 42 } },
        ],
        expected: 'event1',
      };

      const result = matcher.matchFile(file, rule);
      expect(result.matched).toBe(true);
      expect(result.checks).toHaveLength(3);
      expect(result.checks.every(c => c.status)).toBe(true);
    });

    it('should fail when one criterion fails', () => {
      const file: JsonFile = {
        fileName: 'test.json',
        data: { type: 'event1', status: 'inactive' },
      };

      const rule: MatchRule = {
        match: [
          { path: ['type'], check: { value: 'event1' } },
          { path: ['status'], check: { value: 'active' } },
        ],
        expected: 'event1',
      };

      const result = matcher.matchFile(file, rule);
      expect(result.matched).toBe(false);
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].status).toBe(true);
      expect(result.checks[1].status).toBe(false);
    });

    it('should match wildcard rule', () => {
      const file: JsonFile = {
        fileName: 'optional.json',
        data: { type: 'optional' },
      };

      const rule: MatchRule = {
        matchAny: [{ path: ['type'], check: { value: 'optional' } }],
        optional: true,
      };

      const result = matcher.matchFile(file, rule);
      expect(result.matched).toBe(true);
    });
  });

  describe('filterFiles - Basic', () => {
    it('should filter empty file list', () => {
      const result = matcher.filterFiles([], []);

      expect(result.mapped).toHaveLength(0);
      expect(result.wildcardMatched).toHaveLength(0);
      expect(result.unmapped).toHaveLength(0);
      expect(result.stats.totalFiles).toBe(0);
    });

    it('should filter files with no rules', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'file2.json', data: { type: 'event2' } },
      ];

      const result = matcher.filterFiles(files, []);

      expect(result.mapped).toHaveLength(0);
      expect(result.unmapped).toHaveLength(2);
      expect(result.stats.unmappedFiles).toBe(2);
    });

    it('should map files to rules in order', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'file2.json', data: { type: 'event2' } },
        { fileName: 'file3.json', data: { type: 'event3' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
        { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(3);
      expect(result.unmapped).toHaveLength(0);
      expect(result.mapped[0].expected).toBe('event1');
      expect(result.mapped[1].expected).toBe('event2');
      expect(result.mapped[2].expected).toBe('event3');
    });

    it('should handle optional rules that do not match', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'file2.json', data: { type: 'event3' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          match: [{ path: ['type'], check: { value: 'event2' } }],
          expected: 'event2',
          optional: true,
        },
        { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(2);
      expect(result.unmapped).toHaveLength(0);
      expect(result.mapped[0].expected).toBe('event1');
      expect(result.mapped[1].expected).toBe('event3');
    });

    it('should mark files as unmapped when mandatory rule fails', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'file2.json', data: { type: 'unknown' } },
        { fileName: 'file3.json', data: { type: 'event3' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' }, // Mandatory
        { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(1); // Only event1
      expect(result.unmapped).toHaveLength(2); // unknown and event3
    });
  });

  describe('filterFiles - Flexible Ordering', () => {
    it('should handle flexible ordering (array of rules)', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'file4.json', data: { type: 'event4' } }, // event4 before event3
        { fileName: 'file3.json', data: { type: 'event3' } },
        { fileName: 'file5.json', data: { type: 'event5' } },
      ];

      const rules: (MatchRule | MatchRule[])[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        [
          { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
          { match: [{ path: ['type'], check: { value: 'event4' } }], expected: 'event4' },
        ],
        { match: [{ path: ['type'], check: { value: 'event5' } }], expected: 'event5' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(4);
      expect(result.unmapped).toHaveLength(0);

      const expectedNames = result.mapped.map(m => m.expected);
      expect(expectedNames).toContain('event1');
      expect(expectedNames).toContain('event3');
      expect(expectedNames).toContain('event4');
      expect(expectedNames).toContain('event5');
    });

    it('should exhaust all subrules in flexible ordering', () => {
      const files: JsonFile[] = [
        { fileName: 'a.json', data: { type: 'a' } },
        { fileName: 'b.json', data: { type: 'b' } },
        { fileName: 'c.json', data: { type: 'c' } },
      ];

      const rules: (MatchRule | MatchRule[])[] = [
        [
          { match: [{ path: ['type'], check: { value: 'a' } }], expected: 'a' },
          { match: [{ path: ['type'], check: { value: 'b' } }], expected: 'b' },
          { match: [{ path: ['type'], check: { value: 'c' } }], expected: 'c' },
        ],
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(3);
      expect(result.unmapped).toHaveLength(0);
    });
  });

  describe('filterFiles - Wildcard Matching', () => {
    it('should match single file with non-greedy wildcard', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'opt1.json', data: { type: 'optional' } },
        { fileName: 'opt2.json', data: { type: 'optional' } },
        { fileName: 'file2.json', data: { type: 'event2' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { matchAny: [{ path: ['type'], check: { value: 'optional' } }], optional: true }, // non-greedy
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(2); // event1, event2
      expect(result.wildcardMatched).toHaveLength(1); // Only first optional
      expect(result.unmapped).toHaveLength(1); // Second optional
    });

    it('should match all files with greedy wildcard', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'opt1.json', data: { type: 'optional' } },
        { fileName: 'opt2.json', data: { type: 'optional' } },
        { fileName: 'opt3.json', data: { type: 'optional' } },
        { fileName: 'file2.json', data: { type: 'event2' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          optional: true,
          greedy: true,
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(2); // event1, event2
      expect(result.wildcardMatched).toHaveLength(3); // All 3 optionals
      expect(result.unmapped).toHaveLength(0);
    });

    it('should skip wildcard when no matching files', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'file2.json', data: { type: 'event2' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          optional: true,
          greedy: true,
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.mapped).toHaveLength(2);
      expect(result.wildcardMatched).toHaveLength(0);
      expect(result.unmapped).toHaveLength(0);
    });
  });

  describe('filterFiles - Sort Function', () => {
    it('should sort files before matching', () => {
      const files: JsonFile[] = [
        { fileName: 'file3.json', data: { type: 'event', order: 3 } },
        { fileName: 'file1.json', data: { type: 'event', order: 1 } },
        { fileName: 'file2.json', data: { type: 'event', order: 2 } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['order'], check: { value: 1 } }], expected: 'first' },
        { match: [{ path: ['order'], check: { value: 2 } }], expected: 'second' },
        { match: [{ path: ['order'], check: { value: 3 } }], expected: 'third' },
      ];

      const result = matcher.filterFiles(files, rules, (a, b) => a.data.order - b.data.order);

      expect(result.mapped).toHaveLength(3);
      expect(result.mapped[0].expected).toBe('first');
      expect(result.mapped[1].expected).toBe('second');
      expect(result.mapped[2].expected).toBe('third');
    });

    it('should not modify original array', () => {
      const files: JsonFile[] = [
        { fileName: 'file3.json', data: { order: 3 } },
        { fileName: 'file1.json', data: { order: 1 } },
        { fileName: 'file2.json', data: { order: 2 } },
      ];

      const originalOrder = files.map(f => f.fileName);

      matcher.filterFiles(files, [], (a, b) => a.data.order - b.data.order);

      const currentOrder = files.map(f => f.fileName);
      expect(currentOrder).toEqual(originalOrder);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'opt1.json', data: { type: 'optional' } },
        { fileName: 'file2.json', data: { type: 'event2' } },
        { fileName: 'unknown.json', data: { type: 'unknown' } },
      ];

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { matchAny: [{ path: ['type'], check: { value: 'optional' } }], optional: true },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ];

      const result = matcher.filterFiles(files, rules);

      expect(result.stats.totalFiles).toBe(4);
      expect(result.stats.mappedFiles).toBe(2); // event1, event2
      expect(result.stats.wildcardMatchedFiles).toBe(1); // optional
      expect(result.stats.unmappedFiles).toBe(1); // unknown
      expect(result.stats.totalRules).toBe(3);
      expect(result.stats.mandatoryRules).toBe(2); // event1, event2
      expect(result.stats.optionalRules).toBe(1); // wildcard
    });

    it('should count flexible ordering rules correctly', () => {
      const rules: (MatchRule | MatchRule[])[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        [
          { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
          {
            match: [{ path: ['type'], check: { value: 'event3' } }],
            expected: 'event3',
            optional: true,
          },
        ],
        { matchAny: [{ path: ['type'], check: { value: 'optional' } }], optional: true },
      ];

      const result = matcher.filterFiles([], rules);

      expect(result.stats.totalRules).toBe(4); // 1 + 2 (from array) + 1
      expect(result.stats.mandatoryRules).toBe(2); // event1, event2
      expect(result.stats.optionalRules).toBe(2); // event3, wildcard
    });
  });
});
