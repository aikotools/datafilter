import { describe, it, expect } from 'vitest'
import { Matcher } from '../../src/matcher/Matcher'
import type { JsonFile, MatchRule } from '../../src/core/types'

describe('Optional Mode', () => {
  const matcher = new Matcher()

  describe('mode: optional', () => {
    it('should mark files between matches as optional', () => {
      const files: JsonFile[] = [
        { fileName: 'critical_A.json', data: { type: 'critical', id: 1 } },
        { fileName: 'info_1.json', data: { type: 'info', id: 2 } },
        { fileName: 'debug_1.json', data: { type: 'debug', id: 3 } },
        { fileName: 'critical_B.json', data: { type: 'critical', id: 4 } },
        { fileName: 'info_2.json', data: { type: 'info', id: 5 } },
        { fileName: 'critical_C.json', data: { type: 'critical', id: 6 } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A' },
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'B' },
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'C' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'optional')

      // All critical files should be mapped
      expect(result.mapped).toHaveLength(3)
      expect(result.mapped[0].expected).toBe('A')
      expect(result.mapped[1].expected).toBe('B')
      expect(result.mapped[2].expected).toBe('C')

      // Non-critical files should be marked as optional
      expect(result.optionalFiles).toHaveLength(3)
      expect(result.optionalFiles[0].fileName).toBe('info_1.json')
      expect(result.optionalFiles[1].fileName).toBe('debug_1.json')
      expect(result.optionalFiles[2].fileName).toBe('info_2.json')

      // unmapped should always be empty in optional mode
      expect(result.unmapped).toHaveLength(0)

      // Check statistics
      expect(result.stats.totalFiles).toBe(6)
      expect(result.stats.mappedFiles).toBe(3)
      expect(result.stats.optionalFiles).toBe(3)
      expect(result.stats.unmappedFiles).toBe(0)
    })

    it('should track position and between information for optional files', () => {
      const files: JsonFile[] = [
        { fileName: 'A.json', data: { id: 1 } },
        { fileName: 'x.json', data: { id: 2 } },
        { fileName: 'y.json', data: { id: 3 } },
        { fileName: 'B.json', data: { id: 4 } },
        { fileName: 'z.json', data: { id: 5 } },
        { fileName: 'C.json', data: { id: 6 } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['id'], check: { value: 1 } }], expected: 'A' },
        { match: [{ path: ['id'], check: { value: 4 } }], expected: 'B' },
        { match: [{ path: ['id'], check: { value: 6 } }], expected: 'C' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'optional')

      expect(result.optionalFiles).toHaveLength(3)

      // Check x.json (position 1, between A and B)
      expect(result.optionalFiles[0].fileName).toBe('x.json')
      expect(result.optionalFiles[0].position).toBe(1)
      expect(result.optionalFiles[0].between?.afterRule).toBe('A')
      expect(result.optionalFiles[0].between?.beforeRule).toBe('B')

      // Check y.json (position 2, between A and B)
      expect(result.optionalFiles[1].fileName).toBe('y.json')
      expect(result.optionalFiles[1].position).toBe(2)
      expect(result.optionalFiles[1].between?.afterRule).toBe('A')
      expect(result.optionalFiles[1].between?.beforeRule).toBe('B')

      // Check z.json (position 4, between B and C)
      expect(result.optionalFiles[2].fileName).toBe('z.json')
      expect(result.optionalFiles[2].position).toBe(4)
      expect(result.optionalFiles[2].between?.afterRule).toBe('B')
      expect(result.optionalFiles[2].between?.beforeRule).toBe('C')
    })

    it('should mark files before first match as optional', () => {
      const files: JsonFile[] = [
        { fileName: 'pre1.json', data: { type: 'pre' } },
        { fileName: 'pre2.json', data: { type: 'pre' } },
        { fileName: 'match.json', data: { type: 'match' } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'match' } }], expected: 'match' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'optional')

      expect(result.mapped).toHaveLength(1)
      expect(result.optionalFiles).toHaveLength(2)
      expect(result.optionalFiles[0].between?.afterRule).toBe('(start)')
      expect(result.optionalFiles[0].between?.beforeRule).toBe('match')
      expect(result.optionalFiles[1].between?.afterRule).toBe('(start)')
      expect(result.optionalFiles[1].between?.beforeRule).toBe('match')
    })

    it('should mark files after last match as optional', () => {
      const files: JsonFile[] = [
        { fileName: 'match.json', data: { type: 'match' } },
        { fileName: 'post1.json', data: { type: 'post' } },
        { fileName: 'post2.json', data: { type: 'post' } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'match' } }], expected: 'match' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'optional')

      expect(result.mapped).toHaveLength(1)
      expect(result.optionalFiles).toHaveLength(2)
      expect(result.optionalFiles[0].between?.afterRule).toBe('match')
      expect(result.optionalFiles[0].between?.beforeRule).toBe('(end)')
      expect(result.optionalFiles[1].between?.afterRule).toBe('match')
      expect(result.optionalFiles[1].between?.beforeRule).toBe('(end)')
    })

    it('should handle all files as optional when no rules match', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event' } },
        { fileName: 'file2.json', data: { type: 'event' } },
        { fileName: 'file3.json', data: { type: 'event' } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'nonexistent' } }], expected: 'none' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'optional')

      expect(result.mapped).toHaveLength(0)
      expect(result.optionalFiles).toHaveLength(3)
      expect(result.unmapped).toHaveLength(0)
      expect(result.optionalFiles[0].between?.afterRule).toBe('(start)')
      expect(result.optionalFiles[0].between?.beforeRule).toBe('(end)')
    })

    it('should handle empty file list', () => {
      const result = matcher.filterFiles([], [], undefined, undefined, 'optional')

      expect(result.mapped).toHaveLength(0)
      expect(result.optionalFiles).toHaveLength(0)
      expect(result.unmapped).toHaveLength(0)
      expect(result.stats.totalFiles).toBe(0)
    })

    it('should work with sort function', () => {
      const files: JsonFile[] = [
        { fileName: 'file3.json', data: { type: 'match', order: 3 } },
        { fileName: 'opt2.json', data: { type: 'opt', order: 2 } },
        { fileName: 'file1.json', data: { type: 'match', order: 1 } },
        { fileName: 'opt4.json', data: { type: 'opt', order: 4 } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'match' } }], expected: 'first' },
        { match: [{ path: ['type'], check: { value: 'match' } }], expected: 'second' },
      ]

      const result = matcher.filterFiles(
        files,
        rules,
        (a, b) => a.data.order - b.data.order,
        undefined,
        'optional'
      )

      // After sorting: file1 (order 1), opt2 (order 2), file3 (order 3), opt4 (order 4)
      expect(result.mapped).toHaveLength(2)
      expect(result.mapped[0].expected).toBe('first')
      expect(result.mapped[0].file.data.order).toBe(1)
      expect(result.mapped[1].expected).toBe('second')
      expect(result.mapped[1].file.data.order).toBe(3)

      expect(result.optionalFiles).toHaveLength(2)
      expect(result.optionalFiles[0].fileName).toBe('opt2.json') // between first and second
      expect(result.optionalFiles[1].fileName).toBe('opt4.json') // after second
    })

    it('should work with flexible ordering (array of rules)', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'event1' } },
        { fileName: 'opt1.json', data: { type: 'opt' } },
        { fileName: 'file4.json', data: { type: 'event4' } }, // event4 before event3
        { fileName: 'opt2.json', data: { type: 'opt' } },
        { fileName: 'file3.json', data: { type: 'event3' } },
        { fileName: 'file5.json', data: { type: 'event5' } },
      ]

      const rules: (MatchRule | MatchRule[])[] = [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        [
          { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
          { match: [{ path: ['type'], check: { value: 'event4' } }], expected: 'event4' },
        ],
        { match: [{ path: ['type'], check: { value: 'event5' } }], expected: 'event5' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'optional')

      // In optional mode with flexible ordering, each rule in the array can match independently
      // So event1, event4 (from array), event3 (also from array), and event5 are matched
      expect(result.mapped).toHaveLength(4) // event1, event4, event3, event5
      expect(result.optionalFiles).toHaveLength(2) // opt1, opt2
      expect(result.unmapped).toHaveLength(0)

      // Verify the mapped files
      expect(result.mapped[0].expected).toBe('event1')
      expect(result.mapped[1].expected).toBe('event4') // event4 comes first in file order
      expect(result.mapped[2].expected).toBe('event3') // event3 comes after event4
      expect(result.mapped[3].expected).toBe('event5')
    })

    it('should work with wildcard rules', () => {
      const files: JsonFile[] = [
        { fileName: 'A.json', data: { type: 'critical', id: 1 } },
        { fileName: 'x.json', data: { type: 'info', id: 2 } },
        { fileName: 'w.json', data: { type: 'wildcard', id: 3 } },
        { fileName: 'B.json', data: { type: 'critical', id: 4 } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A' },
        {
          matchAny: [{ path: ['type'], check: { value: 'wildcard' } }],
          optional: true,
          greedy: true,
        },
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'B' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'optional')

      expect(result.mapped).toHaveLength(2) // A and B
      expect(result.wildcardMatched).toHaveLength(1) // w.json
      expect(result.optionalFiles).toHaveLength(1) // x.json (between A and wildcard match)
      expect(result.unmapped).toHaveLength(0)
    })

    it('should work with preFilter', () => {
      const files: JsonFile[] = [
        { fileName: 'active1.json', data: { type: 'critical', status: 'active' } },
        { fileName: 'inactive1.json', data: { type: 'info', status: 'inactive' } },
        { fileName: 'active2.json', data: { type: 'info', status: 'active' } },
        { fileName: 'active3.json', data: { type: 'critical', status: 'active' } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A' },
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'B' },
      ]

      const result = matcher.filterFiles(
        files,
        rules,
        undefined,
        [{ path: ['status'], check: { value: 'active' } }],
        'optional'
      )

      expect(result.mapped).toHaveLength(2) // active1 and active3
      expect(result.optionalFiles).toHaveLength(1) // active2 (info type)
      expect(result.preFiltered).toHaveLength(1) // inactive1
      expect(result.unmapped).toHaveLength(0)
    })
  })

  describe('mode: strict-optional', () => {
    it('should work similar to optional mode for simple cases', () => {
      const files: JsonFile[] = [
        { fileName: 'A.json', data: { type: 'critical', id: 1 } },
        { fileName: 'x.json', data: { type: 'info', id: 2 } },
        { fileName: 'B.json', data: { type: 'critical', id: 4 } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A' },
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'B' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'strict-optional')

      expect(result.mapped).toHaveLength(2)
      expect(result.optionalFiles).toHaveLength(1)
      expect(result.unmapped).toHaveLength(0)
    })

    it('should always have empty unmapped array', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { type: 'unknown' } },
        { fileName: 'file2.json', data: { type: 'unknown' } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'critical' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'strict-optional')

      expect(result.unmapped).toHaveLength(0)
      expect(result.optionalFiles).toHaveLength(2)
      expect(result.mapped).toHaveLength(0)
    })
  })

  describe('mode: strict (default)', () => {
    it('should have empty optionalFiles array in strict mode', () => {
      const files: JsonFile[] = [
        { fileName: 'A.json', data: { type: 'critical' } },
        { fileName: 'x.json', data: { type: 'info' } },
        { fileName: 'B.json', data: { type: 'critical' } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A' },
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'B' },
      ]

      const result = matcher.filterFiles(files, rules, undefined, undefined, 'strict')

      expect(result.mapped).toHaveLength(2) // A and B
      expect(result.optionalFiles).toHaveLength(0)
      expect(result.unmapped).toHaveLength(1) // only x
    })

    it('should work without mode parameter (defaults to strict)', () => {
      const files: JsonFile[] = [
        { fileName: 'A.json', data: { type: 'critical' } },
        { fileName: 'x.json', data: { type: 'info' } },
      ]

      const rules: MatchRule[] = [
        { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A' },
      ]

      const result = matcher.filterFiles(files, rules)

      expect(result.mapped).toHaveLength(1)
      expect(result.optionalFiles).toHaveLength(0)
      expect(result.unmapped).toHaveLength(1)
    })
  })

  describe('filterFilesWithGroups - optional mode', () => {
    it('should support optional mode with groups', () => {
      const files: JsonFile[] = [
        { fileName: 'A1.json', data: { type: 'critical', group: 'A' } },
        { fileName: 'A_opt.json', data: { type: 'info', group: 'A' } },
        { fileName: 'A2.json', data: { type: 'critical', group: 'A' } },
        { fileName: 'B1.json', data: { type: 'critical', group: 'B' } },
      ]

      const groups = [
        {
          groupFilter: [{ path: ['group'], check: { value: 'A' } }],
          rules: [
            { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A1' },
            { match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'A2' },
          ],
        },
        {
          groupFilter: [{ path: ['group'], check: { value: 'B' } }],
          rules: [{ match: [{ path: ['type'], check: { value: 'critical' } }], expected: 'B1' }],
        },
      ]

      const result = matcher.filterFilesWithGroups(files, groups, undefined, undefined, 'optional')

      expect(result.mapped).toHaveLength(3) // A1, A2, B1
      expect(result.optionalFiles).toHaveLength(1) // A_opt
      expect(result.unmapped).toHaveLength(0)
    })
  })
})
