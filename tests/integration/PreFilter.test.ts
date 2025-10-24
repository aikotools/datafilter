import { describe, it, expect } from 'vitest'
import { filterFiles } from '../../src'
import type { JsonFile } from '../../src'

describe('PreFilter Integration', () => {
  it('should exclude files via preFilter and keep them separate from unmapped', () => {
    const files: JsonFile[] = [
      { fileName: 'active1.json', data: { type: 'event1', status: 'active' } },
      { fileName: 'inactive1.json', data: { type: 'event1', status: 'inactive' } },
      { fileName: 'active2.json', data: { type: 'event2', status: 'active' } },
      { fileName: 'inactive2.json', data: { type: 'unknown', status: 'inactive' } },
      { fileName: 'active3.json', data: { type: 'unknown', status: 'active' } },
    ]

    const result = filterFiles({
      files,
      preFilter: [{ path: ['status'], check: { value: 'active' } }],
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ],
    })

    // active1 and active2 should be mapped
    expect(result.mapped).toHaveLength(2)
    expect(result.mapped[0].file.fileName).toBe('active1.json')
    expect(result.mapped[1].file.fileName).toBe('active2.json')

    // inactive files should be in preFiltered (not unmapped)
    expect(result.preFiltered).toHaveLength(2)
    expect(result.preFiltered[0].file.fileName).toBe('inactive1.json')
    expect(result.preFiltered[1].file.fileName).toBe('inactive2.json')

    // active3 didn't match any rule, so it's unmapped
    expect(result.unmapped).toHaveLength(1)
    expect(result.unmapped[0].file.fileName).toBe('active3.json')

    // Stats should be correct
    expect(result.stats.totalFiles).toBe(5)
    expect(result.stats.mappedFiles).toBe(2)
    expect(result.stats.preFilteredFiles).toBe(2)
    expect(result.stats.unmappedFiles).toBe(1)
  })

  it('should track failed checks in preFiltered files', () => {
    const files: JsonFile[] = [
      { fileName: 'valid.json', data: { status: 'active', deleted: false } },
      { fileName: 'invalid1.json', data: { status: 'inactive', deleted: false } },
      { fileName: 'invalid2.json', data: { status: 'active', deleted: true } },
      { fileName: 'invalid3.json', data: { status: 'inactive', deleted: true } },
    ]

    const result = filterFiles({
      files,
      preFilter: [
        { path: ['status'], check: { value: 'active' } },
        { path: ['deleted'], check: { value: false } },
      ],
      rules: [{ match: [{ path: ['status'], check: { exists: true } }], expected: 'any' }],
    })

    expect(result.mapped).toHaveLength(1)
    expect(result.preFiltered).toHaveLength(3)

    // invalid1 fails only status check
    expect(result.preFiltered[0].file.fileName).toBe('invalid1.json')
    expect(result.preFiltered[0].failedChecks).toHaveLength(1)
    expect(result.preFiltered[0].failedChecks[0].checkType).toBe('checkValue')

    // invalid2 fails only deleted check
    expect(result.preFiltered[1].file.fileName).toBe('invalid2.json')
    expect(result.preFiltered[1].failedChecks).toHaveLength(1)

    // invalid3 fails both checks
    expect(result.preFiltered[2].file.fileName).toBe('invalid3.json')
    expect(result.preFiltered[2].failedChecks).toHaveLength(2)
  })

  it('should work with groups and preFilter', () => {
    const files: JsonFile[] = [
      { fileName: 'groupA-active.json', data: { group: 'A', status: 'active', type: 'event' } },
      {
        fileName: 'groupA-inactive.json',
        data: { group: 'A', status: 'inactive', type: 'event' },
      },
      { fileName: 'groupB-active.json', data: { group: 'B', status: 'active', type: 'event' } },
    ]

    const result = filterFiles({
      files,
      preFilter: [{ path: ['status'], check: { value: 'active' } }],
      groups: [
        {
          groupFilter: [{ path: ['group'], check: { value: 'A' } }],
          rules: [{ match: [{ path: ['type'], check: { value: 'event' } }], expected: 'eventA' }],
        },
        {
          groupFilter: [{ path: ['group'], check: { value: 'B' } }],
          rules: [{ match: [{ path: ['type'], check: { value: 'event' } }], expected: 'eventB' }],
        },
      ],
    })

    expect(result.mapped).toHaveLength(2)
    expect(result.mapped[0].expected).toBe('eventA')
    expect(result.mapped[1].expected).toBe('eventB')

    expect(result.preFiltered).toHaveLength(1)
    expect(result.preFiltered[0].file.fileName).toBe('groupA-inactive.json')

    expect(result.stats.preFilteredFiles).toBe(1)
  })

  it('should handle empty preFilter gracefully', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1' } },
      { fileName: 'file2.json', data: { type: 'event2' } },
    ]

    const result = filterFiles({
      files,
      preFilter: [],
      rules: [{ match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' }],
    })

    expect(result.mapped).toHaveLength(1)
    expect(result.preFiltered).toHaveLength(0)
    expect(result.unmapped).toHaveLength(1)
  })

  it('should handle no preFilter gracefully', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1' } },
      { fileName: 'file2.json', data: { type: 'event2' } },
    ]

    const result = filterFiles({
      files,
      rules: [{ match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' }],
    })

    expect(result.mapped).toHaveLength(1)
    expect(result.preFiltered).toHaveLength(0)
    expect(result.unmapped).toHaveLength(1)
    expect(result.stats.preFilteredFiles).toBe(0)
  })

  it('should handle all files being preFiltered', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { status: 'inactive' } },
      { fileName: 'file2.json', data: { status: 'inactive' } },
      { fileName: 'file3.json', data: { status: 'inactive' } },
    ]

    const result = filterFiles({
      files,
      preFilter: [{ path: ['status'], check: { value: 'active' } }],
      rules: [{ match: [{ path: ['status'], check: { exists: true } }], expected: 'any' }],
    })

    expect(result.mapped).toHaveLength(0)
    expect(result.unmapped).toHaveLength(0)
    expect(result.preFiltered).toHaveLength(3)
    expect(result.stats.totalFiles).toBe(3)
    expect(result.stats.preFilteredFiles).toBe(3)
  })

  it('should combine preFilter with sortFn correctly', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { status: 'active', order: 3 } },
      { fileName: 'file2.json', data: { status: 'inactive', order: 1 } },
      { fileName: 'file3.json', data: { status: 'active', order: 1 } },
      { fileName: 'file4.json', data: { status: 'active', order: 2 } },
    ]

    const result = filterFiles({
      files,
      preFilter: [{ path: ['status'], check: { value: 'active' } }],
      rules: [{ match: [{ path: ['status'], check: { exists: true } }], expected: 'any' }],
      sortFn: (a, b) => a.data.order - b.data.order,
    })

    // Only active files should be processed, and they should be sorted
    expect(result.mapped).toHaveLength(1) // Only first one matched
    expect(result.mapped[0].file.data.order).toBe(1) // file3 (lowest order among active)
    expect(result.preFiltered).toHaveLength(1) // file2
    expect(result.unmapped).toHaveLength(2) // file1 and file4
  })
})
