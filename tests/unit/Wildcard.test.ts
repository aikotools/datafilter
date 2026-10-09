import { describe, it, expect } from 'vitest'
import { FilterEngine } from '../../src/engine/FilterEngine'
import { expandWildcardPaths, hasWildcard } from '../../src/utils/ObjectAccess'
import type { FilterCriterion } from '../../src/core/types'

/**
 * Wildcards in a criterion path.
 *
 * A protobuf map is keyed by an id the sender assigns — addressing an entry by that id ties
 * the criterion to a number nobody controls. `'*'` stands for one segment and matches any key
 * of an object or any index of an array; the criterion passes as soon as one entry satisfies
 * the check.
 */

describe('expandWildcardPaths', () => {
  it('expands an object key into every existing key', () => {
    const data = { messages: { '3': { code: 'A' }, '7': { code: 'B' } } }

    expect(expandWildcardPaths(data, ['messages', '*', 'code'])).toEqual([
      ['messages', '3', 'code'],
      ['messages', '7', 'code'],
    ])
  })

  it('expands an array index and keeps it numeric', () => {
    const data = { items: [{ id: 1 }, { id: 2 }] }

    expect(expandWildcardPaths(data, ['items', '*', 'id'])).toEqual([
      ['items', 0, 'id'],
      ['items', 1, 'id'],
    ])
  })

  it('builds the cross product for two wildcards', () => {
    const data = { a: { x: { v: 1 }, y: { v: 2 } }, b: { z: { v: 3 } } }

    expect(expandWildcardPaths(data, ['*', '*', 'v'])).toEqual([
      ['a', 'x', 'v'],
      ['a', 'y', 'v'],
      ['b', 'z', 'v'],
    ])
  })

  it('leaves out branches where the rest of the path does not exist', () => {
    const data = { m: { '1': { code: 'A' }, '2': { text: 'no code here' } } }

    expect(expandWildcardPaths(data, ['m', '*', 'code'])).toEqual([['m', '1', 'code']])
  })

  it('returns an empty list when nothing matches', () => {
    expect(expandWildcardPaths({ m: {} }, ['m', '*', 'code'])).toEqual([])
    expect(expandWildcardPaths({}, ['m', '*'])).toEqual([])
  })

  it('returns the path itself when it has no wildcard and exists', () => {
    expect(expandWildcardPaths({ a: { b: 1 } }, ['a', 'b'])).toEqual([['a', 'b']])
    expect(expandWildcardPaths({ a: { b: 1 } }, ['a', 'c'])).toEqual([])
  })

  it('does not treat a primitive as a container', () => {
    expect(expandWildcardPaths({ a: 'text' }, ['a', '*'])).toEqual([])
  })
})

describe('hasWildcard', () => {
  it('finds a wildcard at any position', () => {
    expect(hasWildcard(['a', '*', 'b'])).toBe(true)
    expect(hasWildcard(['*'])).toBe(true)
    expect(hasWildcard(['a', 'b'])).toBe(false)
    expect(hasWildcard([])).toBe(false)
  })
})

describe('FilterEngine with wildcards', () => {
  const engine = new FilterEngine()
  /** Eine Protobuf-Map, geschluesselt nach der vom Sender vergebenen Nachrichten-Id. */
  const data = {
    allNachricht: {
      allRisKundenGrund: {
        '3': { nachrichtId: 3, code: '3', text: 'Feuerwehreinsatz auf der Strecke' },
      },
    },
    allFahrtereignis: [{ ausgefallen: false }, { ausgefallen: true }],
  }

  it('matches a map entry without knowing its key', () => {
    const criterion: FilterCriterion = {
      path: ['allNachricht', 'allRisKundenGrund', '*', 'code'],
      check: { value: '3' },
    }

    const result = engine.evaluateCriterion(data, criterion)
    expect(result.status).toBe(true)
    expect(result.checkType).toBe('checkValue')
  })

  it('fails when no entry carries the expected value', () => {
    const criterion: FilterCriterion = {
      path: ['allNachricht', 'allRisKundenGrund', '*', 'code'],
      check: { value: '31' },
    }

    const result = engine.evaluateCriterion(data, criterion)
    expect(result.status).toBe(false)
    expect(JSON.stringify(result.reason)).toContain('1 checked')
  })

  it('says so when the wildcard matches nothing at all', () => {
    const criterion: FilterCriterion = {
      path: ['allNachricht', 'allRisQualitaetsabweichung', '*', 'code'],
      check: { value: '3' },
    }

    const result = engine.evaluateCriterion(data, criterion)
    expect(result.status).toBe(false)
    expect(result.checkType).toBe('wildcard')
    expect(JSON.stringify(result.reason)).toContain('No path matches')
  })

  it('works with oneOf', () => {
    const criterion: FilterCriterion = {
      path: ['allNachricht', 'allRisKundenGrund', '*', 'code'],
      check: { oneOf: ['3', '31'] },
    }

    expect(engine.evaluateCriterion(data, criterion).status).toBe(true)
  })

  it('works with exists', () => {
    const criterion: FilterCriterion = {
      path: ['allNachricht', 'allRisKundenGrund', '*', 'text'],
      check: { exists: true },
    }

    expect(engine.evaluateCriterion(data, criterion).status).toBe(true)
  })

  it('matches any array element', () => {
    const criterion: FilterCriterion = {
      path: ['allFahrtereignis', '*', 'ausgefallen'],
      check: { value: true },
    }

    expect(engine.evaluateCriterion(data, criterion).status).toBe(true)
  })

  it('leaves criteria without a wildcard untouched', () => {
    const criterion: FilterCriterion = {
      path: ['allNachricht', 'allRisKundenGrund', '3', 'code'],
      check: { value: '3' },
    }

    const result = engine.evaluateCriterion(data, criterion)
    expect(result.status).toBe(true)
    expect(result.checkType).toBe('checkValue')
  })
})
