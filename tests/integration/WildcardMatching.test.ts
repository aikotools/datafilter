import { describe, it, expect } from 'vitest'
import { filterFiles } from '../../src'
import type { JsonFile } from '../../src'

describe('Wildcard Matching (NEW Feature)', () => {
  it('should match single optional file with non-greedy wildcard', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1' } },
      { fileName: 'optional1.json', data: { type: 'optional', category: 'extra' } },
      { fileName: 'file2.json', data: { type: 'event2' } },
    ]

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { matchAny: [{ path: ['type'], check: { value: 'optional' } }], optional: true }, // non-greedy by default
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ],
    })

    expect(result.mapped).toHaveLength(2)
    expect(result.wildcardMatched).toHaveLength(1)
    expect(result.unmapped).toHaveLength(0)
    expect(result.wildcardMatched[0].file.fileName).toBe('optional1.json')
  })

  it('should match multiple optional files with greedy wildcard', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1' } },
      { fileName: 'optional1.json', data: { type: 'optional', category: 'extra' } },
      { fileName: 'optional2.json', data: { type: 'optional', category: 'extra' } },
      { fileName: 'optional3.json', data: { type: 'optional', category: 'extra' } },
      { fileName: 'file2.json', data: { type: 'event2' } },
    ]

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          optional: true,
          greedy: true, // match all optional files
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ],
    })

    expect(result.mapped).toHaveLength(2)
    expect(result.wildcardMatched).toHaveLength(3) // All 3 optional files matched
    expect(result.unmapped).toHaveLength(0)

    // Check that all optional files were matched
    const optionalFileNames = result.wildcardMatched.map(m => m.file.fileName)
    expect(optionalFileNames).toContain('optional1.json')
    expect(optionalFileNames).toContain('optional2.json')
    expect(optionalFileNames).toContain('optional3.json')
  })

  it('should skip wildcard rule when no matching files', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1' } },
      { fileName: 'file2.json', data: { type: 'event2' } },
    ]

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          optional: true,
          greedy: true,
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ],
    })

    expect(result.mapped).toHaveLength(2)
    expect(result.wildcardMatched).toHaveLength(0) // No optional files matched
    expect(result.unmapped).toHaveLength(0)
  })

  it('should handle complex scenario from requirements', () => {
    // Requirements scenario:
    // event1
    //     - event1.1 kann kommen, muss aber nicht
    // event2
    //     - event3, event4 für diese Beiden events ist die Reihenfolge nicht klar
    // event5

    const files: JsonFile[] = [
      { fileName: 'event1.json', data: { type: 'event1' } },
      { fileName: 'event1.1.json', data: { type: 'event1.1' } },
      { fileName: 'event2.json', data: { type: 'event2' } },
      { fileName: 'event4.json', data: { type: 'event4' } }, // Note: event4 before event3
      { fileName: 'event3.json', data: { type: 'event3' } },
      { fileName: 'event5.json', data: { type: 'event5' } },
    ]

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          match: [{ path: ['type'], check: { value: 'event1.1' } }],
          expected: 'event1.1',
          optional: true,
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
        [
          // Flexible order
          { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
          { match: [{ path: ['type'], check: { value: 'event4' } }], expected: 'event4' },
        ],
        { match: [{ path: ['type'], check: { value: 'event5' } }], expected: 'event5' },
      ],
    })

    expect(result.mapped).toHaveLength(6)
    expect(result.unmapped).toHaveLength(0)
    expect(result.wildcardMatched).toHaveLength(0)

    // Verify all events were matched
    const expectedNames = result.mapped.map(m => m.expected)
    expect(expectedNames).toContain('event1')
    expect(expectedNames).toContain('event1.1')
    expect(expectedNames).toContain('event2')
    expect(expectedNames).toContain('event3')
    expect(expectedNames).toContain('event4')
    expect(expectedNames).toContain('event5')
  })

  it('should handle complex scenario WITH wildcard optionals', () => {
    // Same as above but with arbitrary optional files using wildcard
    // Note: Wildcard matches between event1 and event2 ONLY

    const files: JsonFile[] = [
      { fileName: 'event1.json', data: { type: 'event1' } },
      { fileName: 'optional_a.json', data: { type: 'optional', info: 'a' } }, // NEW: arbitrary optional
      { fileName: 'optional_b.json', data: { type: 'optional', info: 'b' } }, // NEW: arbitrary optional
      { fileName: 'event2.json', data: { type: 'event2' } },
      { fileName: 'event4.json', data: { type: 'event4' } },
      { fileName: 'event3.json', data: { type: 'event3' } },
      { fileName: 'event5.json', data: { type: 'event5' } },
    ]

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        // NEW: Wildcard to catch arbitrary optionals WITHOUT explicit specification
        // This wildcard only matches files between event1 and event2
        {
          matchAny: [{ path: ['type'], check: { value: 'optional' } }],
          optional: true,
          greedy: true,
        },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
        [
          { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
          { match: [{ path: ['type'], check: { value: 'event4' } }], expected: 'event4' },
        ],
        { match: [{ path: ['type'], check: { value: 'event5' } }], expected: 'event5' },
      ],
    })

    expect(result.mapped).toHaveLength(5) // event1, event2, event3, event4, event5
    expect(result.wildcardMatched).toHaveLength(2) // Only 2 optional files between event1 and event2
    expect(result.unmapped).toHaveLength(0)

    // Verify wildcard matched the optional files
    const optionalFileNames = result.wildcardMatched.map(m => m.file.fileName)
    expect(optionalFileNames).toContain('optional_a.json')
    expect(optionalFileNames).toContain('optional_b.json')
  })
})
