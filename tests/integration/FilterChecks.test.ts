import { describe, it, expect } from 'vitest';
import { filterFiles } from '../../src';
import type { JsonFile } from '../../src';

describe('Filter Checks', () => {
  describe('checkValue', () => {
    it('should match simple values', () => {
      const files: JsonFile[] = [{ fileName: 'file1.json', data: { name: 'John', age: 30 } }];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [
              { path: ['name'], check: { value: 'John' } },
              { path: ['age'], check: { value: 30 } },
            ],
            expected: 'person',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
    });

    it('should match nested objects', () => {
      const files: JsonFile[] = [
        {
          fileName: 'file1.json',
          data: { user: { name: 'John', address: { city: 'Berlin' } } },
        },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['user', 'address', 'city'], check: { value: 'Berlin' } }],
            expected: 'berlin-user',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
    });
  });

  describe('checkExists', () => {
    it('should check if path exists', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { hasOptional: true, optional: 'value' } },
        { fileName: 'file2.json', data: { hasOptional: false } },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['optional'], check: { exists: true } }],
            expected: 'with-optional',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });

    it('should check if path does not exist', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { required: true } },
        { fileName: 'file2.json', data: { required: true, deprecated: 'old' } },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['deprecated'], check: { exists: false } }],
            expected: 'new-format',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });
  });

  describe('checkArrayElement', () => {
    it('should check if array contains element', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { tags: ['javascript', 'typescript', 'react'] } },
        { fileName: 'file2.json', data: { tags: ['python', 'django'] } },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['tags'], check: { itemExists: true, item: 'typescript' } }],
            expected: 'typescript-project',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });

    it('should check if array does not contain element', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { status: ['active', 'verified'] } },
        { fileName: 'file2.json', data: { status: ['active', 'banned'] } },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['status'], check: { itemExists: false, item: 'banned' } }],
            expected: 'good-standing',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });
  });

  describe('checkArraySize', () => {
    it('should check array size with equal', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { items: [1, 2, 3] } },
        { fileName: 'file2.json', data: { items: [1, 2] } },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['items'], check: { type: 'equal', size: 3 } }],
            expected: 'three-items',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });

    it('should check array size with lessThan', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { errors: [] } },
        { fileName: 'file2.json', data: { errors: ['error1', 'error2', 'error3'] } },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['errors'], check: { type: 'lessThan', size: 2 } }],
            expected: 'few-errors',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });

    it('should check array size with greaterThan', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { items: [1, 2, 3, 4, 5] } },
        { fileName: 'file2.json', data: { items: [1] } },
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [{ path: ['items'], check: { type: 'greaterThan', size: 3 } }],
            expected: 'many-items',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });
  });

  describe('checkTimeRange', () => {
    it('should check ISO timestamp within range', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { timestamp: '2023-11-08T15:30:00+01:00' } },
        { fileName: 'file2.json', data: { timestamp: '2023-11-08T18:00:00+01:00' } },
      ];

      const result = filterFiles({
        files,
        rules: [
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
            expected: 'in-range',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });

    it('should check numeric timestamp within range', () => {
      const files: JsonFile[] = [
        { fileName: 'file1.json', data: { timestamp: 1699452000000 } }, // In range
        { fileName: 'file2.json', data: { timestamp: 1699460000000 } }, // Out of range
      ];

      const result = filterFiles({
        files,
        rules: [
          {
            match: [
              {
                path: ['timestamp'],
                check: {
                  min: '1699450000000',
                  max: '1699455000000',
                },
              },
            ],
            expected: 'in-range',
          },
        ],
      });

      expect(result.mapped).toHaveLength(1);
      expect(result.mapped[0].file.fileName).toBe('file1.json');
    });
  });

  describe('Sort Function', () => {
    it('should sort files before matching', () => {
      const files: JsonFile[] = [
        { fileName: 'file3.json', data: { type: 'event', order: 3 } },
        { fileName: 'file1.json', data: { type: 'event', order: 1 } },
        { fileName: 'file2.json', data: { type: 'event', order: 2 } },
      ];

      const result = filterFiles({
        files,
        rules: [
          { match: [{ path: ['order'], check: { value: 1 } }], expected: 'first' },
          { match: [{ path: ['order'], check: { value: 2 } }], expected: 'second' },
          { match: [{ path: ['order'], check: { value: 3 } }], expected: 'third' },
        ],
        sortFn: (a, b) => a.data.order - b.data.order,
      });

      expect(result.mapped).toHaveLength(3);
      expect(result.mapped[0].expected).toBe('first');
      expect(result.mapped[1].expected).toBe('second');
      expect(result.mapped[2].expected).toBe('third');
    });
  });
});
