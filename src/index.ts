/**
 * @aikotools/datafilter
 *
 * Advanced data filtering engine for JSON file matching in E2E testing
 */

// Core exports
export type {
  PathElement,
  TimeUnit,
  CheckValue,
  CheckExists,
  CheckArrayElement,
  CheckArraySize,
  CheckTimeRange,
  CheckNumericRange,
  FilterCriterion,
  SingleMatchRule,
  WildcardMatchRule,
  MatchRule,
  FilterGroup,
  JsonFile,
  FilterCheckResult,
  MatchResult,
  MappedFile,
  WildcardMappedFile,
  UnmappedFile,
  OptionalFile,
  PreFilteredFile,
  FilterResult,
  FilterRequest,
} from './core/types'

export { isWildcardRule, isSingleMatchRule } from './core/types'

// Engine exports
export { FilterEngine } from './engine'

// Matcher exports
export { Matcher } from './matcher'

// Utility exports
export { getValueFromPath, pathExists, getValueOr } from './utils'
export type { AccessResult } from './utils'

// Convenience function
import { Matcher } from './matcher'
import type { FilterRequest, FilterResult } from './core/types'

/**
 * Convenience function for filtering files with a single call.
 * Creates a Matcher instance and performs the filtering operation.
 *
 * @param request - Filter request containing files, rules/groups, sort function, and context
 * @returns FilterResult with mapped, wildcardMatched, and unmapped files
 *
 * @example
 * ```typescript
 * // Using flat rules structure
 * const result = filterFiles({
 *   files: jsonFiles,
 *   rules: [
 *     { match: [{path: ['type'], check: {value: 'event1'}}], expected: 'event1.json' },
 *     { matchAny: [{path: ['optional'], check: {exists: true}}], optional: true, greedy: true },
 *     { match: [{path: ['type'], check: {value: 'event2'}}], expected: 'event2.json' }
 *   ],
 *   sortFn: (a, b) => a.data.timestamp - b.data.timestamp
 * });
 *
 * // Using grouped structure
 * const result = filterFiles({
 *   files: jsonFiles,
 *   preFilter: [{path: ['eventType'], check: {value: 'RiFahrt'}}],
 *   groups: [
 *     {
 *       groupFilter: [{path: ['linie'], check: {value: '88888'}}],
 *       rules: [...]
 *     }
 *   ],
 *   sortFn: (a, b) => a.data.timestamp - b.data.timestamp
 * });
 * ```
 */
export function filterFiles(request: FilterRequest): FilterResult {
  const matcher = new Matcher(request.context)

  // Validate: either rules or groups should be provided
  if (request.rules && request.groups) {
    throw new Error('FilterRequest: Provide either "rules" or "groups", not both')
  }

  if (!request.rules && !request.groups) {
    throw new Error('FilterRequest: Must provide either "rules" or "groups"')
  }

  // Use groups-based filtering if groups are provided
  if (request.groups) {
    return matcher.filterFilesWithGroups(
      request.files,
      request.groups,
      request.sortFn,
      request.preFilter,
      request.mode
    )
  }

  // Use traditional flat rules filtering
  // At this point, we know request.rules exists because we validated above
  if (!request.rules) {
    throw new Error('FilterRequest: Rules are required')
  }
  return matcher.filterFiles(
    request.files,
    request.rules,
    request.sortFn,
    request.preFilter,
    request.mode
  )
}
