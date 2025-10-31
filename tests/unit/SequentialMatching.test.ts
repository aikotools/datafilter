import { describe, it, expect } from 'vitest'
import { filterFiles } from '../../src'
import type { JsonFile, MatchRule } from '../../src'

describe('Sequential Rule Matching', () => {
  describe('Testfall 1: Three identical rules, three matching files', () => {
    it('should map each file to a separate rule sequentially', () => {
      // 3 Files mit name="hugo", unterschiedliche time
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { name: 'hugo', time: 1 } },
        { fileName: 'file2.json', data: { name: 'hugo', time: 2 } },
        { fileName: 'file3.json', data: { name: 'hugo', time: 3 } },
      ]

      // 3 Rules, alle prüfen nur name="hugo"
      const rules: MatchRule[] = [
        {
          match: [
            {
              path: ['name'],
              check: { value: 'hugo' },
            },
          ],
          expected: 'first.json',
        },
        {
          match: [
            {
              path: ['name'],
              check: { value: 'hugo' },
            },
          ],
          expected: 'second.json',
        },
        {
          match: [
            {
              path: ['name'],
              check: { value: 'hugo' },
            },
          ],
          expected: 'third.json',
        },
      ]

      const result = filterFiles({ files, rules, mode: 'strict' })

      // Erwartung: Jedes File wird der Reihe nach einer Rule zugeordnet
      expect(result.stats.mappedFiles).toBe(3)
      expect(result.stats.unmappedFiles).toBe(0)
      expect(result.mapped).toHaveLength(3)

      expect(result.mapped[0].file.fileName).toBe('file1.json')
      expect(result.mapped[0].expected).toBe('first.json')

      expect(result.mapped[1].file.fileName).toBe('file2.json')
      expect(result.mapped[1].expected).toBe('second.json')

      expect(result.mapped[2].file.fileName).toBe('file3.json')
      expect(result.mapped[2].expected).toBe('third.json')
    })

    it('should leave extra files as unmapped when there are more files than rules', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { name: 'hugo', time: 1 } },
        { fileName: 'file2.json', data: { name: 'hugo', time: 2 } },
        { fileName: 'file3.json', data: { name: 'hugo', time: 3 } },
        { fileName: 'file4.json', data: { name: 'hugo', time: 4 } },
      ]

      const rules: MatchRule[] = [
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'first.json',
        },
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'second.json',
        },
      ]

      const result = filterFiles({ files, rules, mode: 'strict' })

      expect(result.stats.mappedFiles).toBe(2)
      expect(result.stats.unmappedFiles).toBe(2)
      expect(result.mapped).toHaveLength(2)
      expect(result.unmapped).toHaveLength(2)

      expect(result.mapped[0].expected).toBe('first.json')
      expect(result.mapped[1].expected).toBe('second.json')
      expect(result.unmapped[0].file.fileName).toBe('file3.json')
      expect(result.unmapped[1].file.fileName).toBe('file4.json')
    })
  })

  describe('Testfall 2: Optional mode with non-matching file', () => {
    it('should handle optional mode correctly with non-matching file in between', () => {
      // 4 Files: hugo(1), hugo(2), other(2), hugo(3)
      const files: JsonFile[] = [
        { fileName: 'hugo1.json', data: { name: 'hugo', time: 1 } },
        { fileName: 'hugo2.json', data: { name: 'hugo', time: 2 } },
        { fileName: 'other.json', data: { name: 'other', time: 2 } },
        { fileName: 'hugo3.json', data: { name: 'hugo', time: 3 } },
      ]

      // 3 Rules für "hugo"
      const rules: MatchRule[] = [
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'first.json',
        },
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'second.json',
        },
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'third.json',
        },
      ]

      const result = filterFiles({ files, rules, mode: 'optional' })

      // Erwartung: hugo files → rules, other → optionalFiles
      expect(result.stats.mappedFiles).toBe(3)
      expect(result.stats.optionalFiles).toBe(1)
      expect(result.stats.unmappedFiles).toBe(0)

      expect(result.mapped).toHaveLength(3)
      expect(result.optionalFiles).toHaveLength(1)

      expect(result.mapped[0].file.fileName).toBe('hugo1.json')
      expect(result.mapped[0].expected).toBe('first.json')

      expect(result.mapped[1].file.fileName).toBe('hugo2.json')
      expect(result.mapped[1].expected).toBe('second.json')

      expect(result.mapped[2].file.fileName).toBe('hugo3.json')
      expect(result.mapped[2].expected).toBe('third.json')

      expect(result.optionalFiles[0].fileName).toBe('other.json')
    })
  })

  describe('Testfall 3: Strict mode continues matching after non-matching file', () => {
    it('should continue matching subsequent files and mark non-matching as unmapped', () => {
      // 4 Files: hugo(1), hugo(2), other(2), hugo(3)
      const files: JsonFile[] = [
        { fileName: 'hugo1.json', data: { name: 'hugo', time: 1 } },
        { fileName: 'hugo2.json', data: { name: 'hugo', time: 2 } },
        { fileName: 'other.json', data: { name: 'other', time: 2 } },
        { fileName: 'hugo3.json', data: { name: 'hugo', time: 3 } },
      ]

      // 3 Rules für "hugo"
      const rules: MatchRule[] = [
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'first.json',
        },
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'second.json',
        },
        {
          match: [{ path: ['name'], check: { value: 'hugo' } }],
          expected: 'third.json',
        },
      ]

      const result = filterFiles({ files, rules, mode: 'strict' })

      // Erwartung: Alle 3 hugo files → rules, other → unmapped
      // Strict mode macht weiter und versucht die restlichen Rules zu erfüllen
      expect(result.stats.mappedFiles).toBe(3)
      expect(result.stats.unmappedFiles).toBe(1)

      expect(result.mapped).toHaveLength(3)
      expect(result.unmapped).toHaveLength(1)

      expect(result.mapped[0].file.fileName).toBe('hugo1.json')
      expect(result.mapped[0].expected).toBe('first.json')

      expect(result.mapped[1].file.fileName).toBe('hugo2.json')
      expect(result.mapped[1].expected).toBe('second.json')

      expect(result.mapped[2].file.fileName).toBe('hugo3.json')
      expect(result.mapped[2].expected).toBe('third.json')

      expect(result.unmapped[0].file.fileName).toBe('other.json')
    })
  })

  describe('Wildcard rules behavior', () => {
    it('wildcard greedy should still match multiple files', () => {
      const files: JsonFile[] = [
        { fileName: 'required.json', data: { type: 'required' } },
        { fileName: 'optional1.json', data: { type: 'optional' } },
        { fileName: 'optional2.json', data: { type: 'optional' } },
        { fileName: 'optional3.json', data: { type: 'optional' } },
      ]

      const rules: MatchRule[] = [
        {
          match: [{ path: ['type'], check: { value: 'required' } }],
          expected: 'required.json',
        },
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          greedy: true,
          optional: true,
        },
      ]

      const result = filterFiles({ files, rules, mode: 'strict' })

      expect(result.stats.mappedFiles).toBe(1)
      expect(result.stats.wildcardMatchedFiles).toBe(3)

      expect(result.mapped[0].file.fileName).toBe('required.json')
      expect(result.wildcardMatched).toHaveLength(3)
    })

    it('wildcard non-greedy matches once per occurrence', () => {
      const files: JsonFile[] = [
        { fileName: 'required.json', data: { type: 'required' } },
        { fileName: 'optional1.json', data: { type: 'optional' } },
        { fileName: 'optional2.json', data: { type: 'optional' } },
      ]

      const rules: MatchRule[] = [
        {
          match: [{ path: ['type'], check: { value: 'required' } }],
          expected: 'required.json',
        },
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          optional: true,
        },
      ]

      const result = filterFiles({ files, rules, mode: 'strict' })

      expect(result.stats.mappedFiles).toBe(1)
      expect(result.stats.wildcardMatchedFiles).toBe(1)
      expect(result.stats.unmappedFiles).toBe(1)

      expect(result.mapped[0].file.fileName).toBe('required.json')
      expect(result.wildcardMatched[0].file.fileName).toBe('optional1.json')
      expect(result.unmapped[0].file.fileName).toBe('optional2.json')
    })
  })

  describe('Flexible rule arrays', () => {
    it('should allow each subrule in flexible array to match once', () => {
      const files: JsonFile[] = [
        { fileName: 'entlastungFuer.json', data: { type: 'entlastungFuer', id: 1 } },
        { fileName: 'entlastungDurch.json', data: { type: 'entlastungDurch', id: 2 } },
      ]

      const rules: (MatchRule | MatchRule[])[] = [
        [
          {
            match: [{ path: ['type'], check: { value: 'entlastungFuer' } }],
            expected: 'entlastungFuer.json',
          },
          {
            match: [{ path: ['type'], check: { value: 'entlastungDurch' } }],
            expected: 'entlastungDurch.json',
          },
        ],
      ]

      const result = filterFiles({ files, rules, mode: 'strict' })

      expect(result.stats.mappedFiles).toBe(2)
      expect(result.stats.unmappedFiles).toBe(0)

      expect(result.mapped[0].file.fileName).toBe('entlastungFuer.json')
      expect(result.mapped[0].expected).toBe('entlastungFuer.json')

      expect(result.mapped[1].file.fileName).toBe('entlastungDurch.json')
      expect(result.mapped[1].expected).toBe('entlastungDurch.json')
    })

    it('should not reuse subrules in flexible array', () => {
      const files: JsonFile[] = [
        { fileName: 'hugo1.json', data: { name: 'hugo' } },
        { fileName: 'hugo2.json', data: { name: 'hugo' } },
        { fileName: 'hugo3.json', data: { name: 'hugo' } },
      ]

      const rules: (MatchRule | MatchRule[])[] = [
        [
          {
            match: [{ path: ['name'], check: { value: 'hugo' } }],
            expected: 'first.json',
          },
          {
            match: [{ path: ['name'], check: { value: 'hugo' } }],
            expected: 'second.json',
          },
        ],
      ]

      const result = filterFiles({ files, rules, mode: 'strict' })

      // Only 2 files should match (one per subrule in the array)
      expect(result.stats.mappedFiles).toBe(2)
      expect(result.stats.unmappedFiles).toBe(1)

      expect(result.mapped[0].expected).toBe('first.json')
      expect(result.mapped[1].expected).toBe('second.json')
      expect(result.unmapped[0].file.fileName).toBe('hugo3.json')
    })
  })
})
