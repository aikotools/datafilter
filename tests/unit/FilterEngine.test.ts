import { describe, it, expect } from 'vitest'
import { FilterEngine } from '../../src/engine/FilterEngine'
import type { FilterCriterion } from '../../src/core/types'

describe('FilterEngine', () => {
  const engine = new FilterEngine()

  describe('checkValue', () => {
    it('should match simple string value', () => {
      const data = { name: 'John' }
      const criterion: FilterCriterion = {
        path: ['name'],
        check: { value: 'John' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
      expect(result.checkType).toBe('checkValue')
    })

    it('should match number value', () => {
      const data = { age: 30 }
      const criterion: FilterCriterion = {
        path: ['age'],
        check: { value: 30 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should match boolean value', () => {
      const data = { active: true }
      const criterion: FilterCriterion = {
        path: ['active'],
        check: { value: true },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should match nested object value', () => {
      const data = { user: { name: 'John', age: 30 } }
      const criterion: FilterCriterion = {
        path: ['user'],
        check: { value: { name: 'John', age: 30 } },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should match array value', () => {
      const data = { tags: ['a', 'b', 'c'] }
      const criterion: FilterCriterion = {
        path: ['tags'],
        check: { value: ['a', 'b', 'c'] },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail on value mismatch', () => {
      const data = { name: 'John' }
      const criterion: FilterCriterion = {
        path: ['name'],
        check: { value: 'Jane' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should fail on type mismatch', () => {
      const data = { age: '30' }
      const criterion: FilterCriterion = {
        path: ['age'],
        check: { value: 30 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should fail when path does not exist', () => {
      const data = { name: 'John' }
      const criterion: FilterCriterion = {
        path: ['age'],
        check: { value: 30 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should match null value', () => {
      const data = { value: null }
      const criterion: FilterCriterion = {
        path: ['value'],
        check: { value: null },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should match zero', () => {
      const data = { count: 0 }
      const criterion: FilterCriterion = {
        path: ['count'],
        check: { value: 0 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should match empty string', () => {
      const data = { text: '' }
      const criterion: FilterCriterion = {
        path: ['text'],
        check: { value: '' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })
  })

  describe('checkExists', () => {
    it('should pass when path exists', () => {
      const data = { user: { name: 'John' } }
      const criterion: FilterCriterion = {
        path: ['user', 'name'],
        check: { exists: true },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
      expect(result.checkType).toBe('checkExists')
    })

    it('should fail when path does not exist and should exist', () => {
      const data = { user: {} }
      const criterion: FilterCriterion = {
        path: ['user', 'name'],
        check: { exists: true },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should pass when path does not exist and should not exist', () => {
      const data = { user: {} }
      const criterion: FilterCriterion = {
        path: ['user', 'name'],
        check: { exists: false },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail when path exists and should not exist', () => {
      const data = { deprecated: 'old' }
      const criterion: FilterCriterion = {
        path: ['deprecated'],
        check: { exists: false },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should treat undefined as non-existent', () => {
      const data = { value: undefined }
      const criterion: FilterCriterion = {
        path: ['value'],
        check: { exists: true },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should treat null as existing', () => {
      const data = { value: null }
      const criterion: FilterCriterion = {
        path: ['value'],
        check: { exists: true },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })
  })

  describe('checkArrayElement', () => {
    it('should find element in array', () => {
      const data = { tags: ['javascript', 'typescript', 'react'] }
      const criterion: FilterCriterion = {
        path: ['tags'],
        check: { itemExists: true, item: 'typescript' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
      expect(result.checkType).toBe('checkArrayElement')
    })

    it('should fail when element not in array', () => {
      const data = { tags: ['javascript', 'react'] }
      const criterion: FilterCriterion = {
        path: ['tags'],
        check: { itemExists: true, item: 'typescript' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should pass when element not in array and should not exist', () => {
      const data = { tags: ['javascript', 'react'] }
      const criterion: FilterCriterion = {
        path: ['tags'],
        check: { itemExists: false, item: 'typescript' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail when element in array and should not exist', () => {
      const data = { status: ['active', 'banned'] }
      const criterion: FilterCriterion = {
        path: ['status'],
        check: { itemExists: false, item: 'banned' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should find complex object in array', () => {
      const data = {
        users: [
          { id: 1, name: 'John' },
          { id: 2, name: 'Jane' },
        ],
      }
      const criterion: FilterCriterion = {
        path: ['users'],
        check: { itemExists: true, item: { id: 2, name: 'Jane' } },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail when value is not an array', () => {
      const data = { tags: 'not-an-array' }
      const criterion: FilterCriterion = {
        path: ['tags'],
        check: { itemExists: true, item: 'value' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should handle empty array', () => {
      const data = { tags: [] }
      const criterion: FilterCriterion = {
        path: ['tags'],
        check: { itemExists: true, item: 'value' },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should find null in array', () => {
      const data = { values: [1, null, 3] }
      const criterion: FilterCriterion = {
        path: ['values'],
        check: { itemExists: true, item: null },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })
  })

  describe('checkArraySize', () => {
    it('should match exact size', () => {
      const data = { items: [1, 2, 3] }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'equal', size: 3 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
      expect(result.checkType).toBe('checkArraySize')
    })

    it('should fail on size mismatch', () => {
      const data = { items: [1, 2] }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'equal', size: 3 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should match lessThan', () => {
      const data = { items: [1, 2] }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'lessThan', size: 5 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail lessThan when equal', () => {
      const data = { items: [1, 2, 3] }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'lessThan', size: 3 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should match greaterThan', () => {
      const data = { items: [1, 2, 3, 4, 5] }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'greaterThan', size: 3 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail greaterThan when equal', () => {
      const data = { items: [1, 2, 3] }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'greaterThan', size: 3 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should handle empty array', () => {
      const data = { items: [] }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'equal', size: 0 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail when value is not an array', () => {
      const data = { items: 'not-an-array' }
      const criterion: FilterCriterion = {
        path: ['items'],
        check: { type: 'equal', size: 3 },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })
  })

  describe('checkTimeRange', () => {
    describe('ISO Timestamps', () => {
      it('should match timestamp within range', () => {
        const data = { timestamp: '2023-11-08T15:30:00+01:00' }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '2023-11-08T15:00:00+01:00',
            max: '2023-11-08T16:00:00+01:00',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(true)
        expect(result.checkType).toBe('checkTimeRange')
      })

      it('should fail when timestamp before range', () => {
        const data = { timestamp: '2023-11-08T14:30:00+01:00' }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '2023-11-08T15:00:00+01:00',
            max: '2023-11-08T16:00:00+01:00',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(false)
      })

      it('should fail when timestamp after range', () => {
        const data = { timestamp: '2023-11-08T17:00:00+01:00' }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '2023-11-08T15:00:00+01:00',
            max: '2023-11-08T16:00:00+01:00',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(false)
      })

      it('should match timestamp at min boundary', () => {
        const data = { timestamp: '2023-11-08T15:00:00+01:00' }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '2023-11-08T15:00:00+01:00',
            max: '2023-11-08T16:00:00+01:00',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(true)
      })

      it('should match timestamp at max boundary', () => {
        const data = { timestamp: '2023-11-08T16:00:00+01:00' }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '2023-11-08T15:00:00+01:00',
            max: '2023-11-08T16:00:00+01:00',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(true)
      })

      it('should fail on invalid ISO timestamp', () => {
        const data = { timestamp: 'invalid-date' }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '2023-11-08T15:00:00+01:00',
            max: '2023-11-08T16:00:00+01:00',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(false)
      })
    })

    describe('Numeric Timestamps', () => {
      it('should match numeric timestamp within range', () => {
        const data = { timestamp: 1699452600000 }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '1699452000000',
            max: '1699455000000',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(true)
      })

      it('should fail when numeric timestamp before range', () => {
        const data = { timestamp: 1699450000000 }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '1699452000000',
            max: '1699455000000',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(false)
      })

      it('should fail when numeric timestamp after range', () => {
        const data = { timestamp: 1699460000000 }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: '1699452000000',
            max: '1699455000000',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(false)
      })

      it('should fail on invalid numeric min/max', () => {
        const data = { timestamp: 1699452600000 }
        const criterion: FilterCriterion = {
          path: ['timestamp'],
          check: {
            min: 'invalid',
            max: 'invalid',
          },
        }

        const result = engine.evaluateCriterion(data, criterion)
        expect(result.status).toBe(false)
      })
    })

    it('should fail on wrong timestamp type', () => {
      const data = { timestamp: { date: '2023-11-08' } }
      const criterion: FilterCriterion = {
        path: ['timestamp'],
        check: {
          min: '2023-11-08T15:00:00+01:00',
          max: '2023-11-08T16:00:00+01:00',
        },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })
  })

  describe('checkOneOf', () => {
    it('should match when value is in allowed set', () => {
      const data = { status: 'PLAN' }
      const criterion: FilterCriterion = {
        path: ['status'],
        check: { oneOf: ['PLAN', 'PROGNOSE'] },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
      expect(result.checkType).toBe('checkOneOf')
    })

    it('should match second value in allowed set', () => {
      const data = { status: 'PROGNOSE' }
      const criterion: FilterCriterion = {
        path: ['status'],
        check: { oneOf: ['PLAN', 'PROGNOSE'] },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail when value is not in allowed set', () => {
      const data = { status: 'ECHT' }
      const criterion: FilterCriterion = {
        path: ['status'],
        check: { oneOf: ['PLAN', 'PROGNOSE'] },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
      expect(result.checkType).toBe('checkOneOf')
    })

    it('should work with numeric values', () => {
      const data = { code: 2 }
      const criterion: FilterCriterion = {
        path: ['code'],
        check: { oneOf: [1, 2, 3] },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should work with nested paths', () => {
      const data = { event: { type: 'ABFAHRT' } }
      const criterion: FilterCriterion = {
        path: ['event', 'type'],
        check: { oneOf: ['ANKUNFT', 'ABFAHRT'] },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })

    it('should fail when path not found', () => {
      const data = { other: 'value' }
      const criterion: FilterCriterion = {
        path: ['status'],
        check: { oneOf: ['PLAN', 'PROGNOSE'] },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
    })

    it('should use deep equality for object values', () => {
      const data = { item: { name: 'A', code: 1 } }
      const criterion: FilterCriterion = {
        path: ['item'],
        check: {
          oneOf: [
            { name: 'A', code: 1 },
            { name: 'B', code: 2 },
          ],
        },
      }

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(true)
    })
  })

  describe('Unknown Check Type', () => {
    it('should fail on unknown check type', () => {
      const data = { value: 42 }
      const criterion = {
        path: ['value'],
        check: { unknownCheck: 'test' },
      } as any // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = engine.evaluateCriterion(data, criterion)
      expect(result.status).toBe(false)
      expect(result.checkType).toBe('unknown')
    })
  })
})
