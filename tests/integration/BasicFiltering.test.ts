import { describe, it, expect } from 'vitest';
import { filterFiles } from '../../src';
import type { JsonFile } from '../../src';

describe('Basic Filtering', () => {
  it('should filter files with simple match rules', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1', value: 42 } },
      { fileName: 'file2.json', data: { type: 'event2', value: 100 } },
      { fileName: 'file3.json', data: { type: 'event3', value: 200 } },
    ];

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
        { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      ],
    });

    expect(result.mapped).toHaveLength(3);
    expect(result.unmapped).toHaveLength(0);
    expect(result.wildcardMatched).toHaveLength(0);
    expect(result.mapped[0].expected).toBe('event1');
    expect(result.mapped[1].expected).toBe('event2');
    expect(result.mapped[2].expected).toBe('event3');
  });

  it('should handle unmapped files', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1' } },
      { fileName: 'file2.json', data: { type: 'unknown' } },
      { fileName: 'file3.json', data: { type: 'event2' } },
    ];

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
      ],
    });

    expect(result.mapped).toHaveLength(2);
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0].file.fileName).toBe('file2.json');
  });

  it('should handle optional rules', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1' } },
      { fileName: 'file2.json', data: { type: 'event3' } },
    ];

    const result = filterFiles({
      files,
      rules: [
        { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
        {
          match: [{ path: ['type'], check: { value: 'event2' } }],
          expected: 'event2',
          optional: true,
        },
        { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      ],
    });

    expect(result.mapped).toHaveLength(2);
    expect(result.unmapped).toHaveLength(0);
    expect(result.mapped[0].expected).toBe('event1');
    expect(result.mapped[1].expected).toBe('event3');
  });

  it('should handle multiple criteria with AND logic', () => {
    const files: JsonFile[] = [
      { fileName: 'file1.json', data: { type: 'event1', status: 'active', value: 42 } },
      { fileName: 'file2.json', data: { type: 'event1', status: 'inactive', value: 100 } },
    ];

    const result = filterFiles({
      files,
      rules: [
        {
          match: [
            { path: ['type'], check: { value: 'event1' } },
            { path: ['status'], check: { value: 'active' } },
          ],
          expected: 'active-event1',
        },
      ],
    });

    expect(result.mapped).toHaveLength(1);
    expect(result.mapped[0].file.fileName).toBe('file1.json');
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0].file.fileName).toBe('file2.json');
  });
});
