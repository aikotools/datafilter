/**
 * Core type definitions for the datafilter engine
 */

/**
 * A single element in a path through a JSON structure.
 * Can be a string for object properties or a number for array indices.
 *
 * @example
 * ['data', 'stations', 0, 'name'] → data.stations[0].name
 */
export type PathElement = string | number

/**
 * Time unit for time-based comparisons
 */
export type TimeUnit =
  | 'milliseconds'
  | 'seconds'
  | 'minutes'
  | 'hours'
  | 'days'
  | 'weeks'
  | 'months'
  | 'years'

/**
 * Check if a value matches an expected value (deep equality)
 */
export interface CheckValue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
}

/**
 * Check if a path exists in the object
 */
export interface CheckExists {
  exists: boolean
}

/**
 * Check if an array contains (or doesn't contain) a specific item
 */
export interface CheckArrayElement {
  itemExists: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any
}

/**
 * Check if an array has a specific size
 */
export interface CheckArraySize {
  type: 'equal' | 'lessThan' | 'greaterThan'
  size: number
}

/**
 * Check if a timestamp is within a time range
 */
export interface CheckTimeRange {
  min: string
  max: string
}

/**
 * Check if a numeric value is within a numeric range
 */
export interface CheckNumericRange {
  min: number
  max: number
}

/**
 * Check if a value is one of a set of allowed values
 */
export interface CheckOneOf {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oneOf: any[]
}

/**
 * A single filter criterion that checks one aspect of the data
 */
export interface FilterCriterion {
  /**
   * Path to the value to check
   */
  path: PathElement[]

  /**
   * The check to perform on the value
   */
  check:
    | CheckValue
    | CheckExists
    | CheckArrayElement
    | CheckArraySize
    | CheckTimeRange
    | CheckNumericRange
    | CheckOneOf
}

/**
 * A single match rule that defines how to match a file
 */
export interface SingleMatchRule {
  /**
   * Filter criteria - all must match (AND logic)
   */
  match: FilterCriterion[]

  /**
   * Expected file name/identifier
   */
  expected: string

  /**
   * Whether this match is optional
   */
  optional?: boolean

  /**
   * Additional metadata for reporting
   */
  info?: Record<string, unknown>
}

/**
 * A wildcard match rule that can match multiple files
 * NEW: Allows matching arbitrary number of optional files without explicit specification
 */
export interface WildcardMatchRule {
  /**
   * Filter criteria for wildcard matching
   */
  matchAny: FilterCriterion[]

  /**
   * Whether to match greedily (as many as possible) or stop after first match
   * Default: false (stop after first match)
   */
  greedy?: boolean

  /**
   * Wildcard matches are always optional
   */
  optional: true

  /**
   * Additional metadata for reporting
   */
  info?: Record<string, unknown>
}

/**
 * A match rule can be either a single match or a wildcard match
 */
export type MatchRule = SingleMatchRule | WildcardMatchRule

/**
 * Type guard to check if a rule is a wildcard rule
 */
export function isWildcardRule(rule: MatchRule): rule is WildcardMatchRule {
  return 'matchAny' in rule
}

/**
 * Type guard to check if a rule is a single match rule
 */
export function isSingleMatchRule(rule: MatchRule): rule is SingleMatchRule {
  return 'match' in rule && 'expected' in rule
}

/**
 * A group of rules with common filter criteria
 * NEW: Allows hierarchical filtering where a group of files shares common properties
 */
export interface FilterGroup {
  /**
   * Common filter criteria that all files in this group must match
   * These are checked before evaluating individual rules
   */
  groupFilter: FilterCriterion[]

  /**
   * Rules to apply to files that match the group filter
   */
  rules: MatchRule[]

  /**
   * Additional metadata for reporting
   */
  info?: Record<string, unknown>
}

/**
 * A file to be filtered
 */
export interface JsonFile {
  /**
   * File name or identifier
   */
  fileName: string

  /**
   * The JSON data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any

  /**
   * Optional metadata
   */
  metadata?: Record<string, unknown>
}

/**
 * Result of filtering a single file against a criterion
 */
export interface FilterCheckResult {
  /**
   * Whether the check passed
   */
  status: boolean

  /**
   * The check that was performed
   */
  checkType: string

  /**
   * Reason for failure (if status is false)
   */
  reason?: string | Record<string, unknown>
}

/**
 * Result of matching a file against a rule
 */
export interface MatchResult {
  /**
   * Whether all criteria matched
   */
  matched: boolean

  /**
   * Individual check results
   */
  checks: FilterCheckResult[]

  /**
   * The rule that was tested
   */
  rule: MatchRule
}

/**
 * A mapped file with its expected identifier
 */
export interface MappedFile {
  /**
   * Expected identifier
   */
  expected: string

  /**
   * The actual file that was matched
   */
  file: JsonFile

  /**
   * Match result details
   */
  matchResult: MatchResult

  /**
   * Optional flag from the rule
   */
  optional: boolean

  /**
   * Additional info from the rule
   */
  info?: Record<string, unknown>
}

/**
 * A wildcard-matched file (matched via matchAny)
 */
export interface WildcardMappedFile {
  /**
   * The file that was matched
   */
  file: JsonFile

  /**
   * Match result details
   */
  matchResult: MatchResult

  /**
   * Additional info from the rule
   */
  info?: Record<string, unknown>
}

/**
 * An unmapped file that didn't match any rule
 */
export interface UnmappedFile {
  /**
   * The file that couldn't be matched
   */
  file: JsonFile

  /**
   * All rules that were tried
   */
  attemptedRules: MatchResult[]
}

/**
 * A pre-filtered file that was excluded by preFilter criteria
 */
export interface PreFilteredFile {
  /**
   * The file that was excluded
   */
  file: JsonFile

  /**
   * The preFilter checks that failed
   */
  failedChecks: FilterCheckResult[]
}

/**
 * A file that was treated as optional (not matched to any mandatory rule)
 * Contains information about why it failed to match
 */
export interface OptionalFile {
  /**
   * File name of the optional file
   */
  fileName: string

  /**
   * Position in the original file sequence
   */
  position: number

  /**
   * Between which matched rules this file appeared
   */
  between?: {
    afterRule: string // Name of the rule before this file
    beforeRule: string // Name of the rule after this file
  }

  /**
   * All rules that were attempted and failed
   * Shows why this file didn't match any rule
   */
  failedMatches: MatchResult[]
}

/**
 * Result of the entire filtering operation
 */
export interface FilterResult {
  /**
   * Successfully mapped files (expected identifier → actual file)
   */
  mapped: MappedFile[]

  /**
   * Files matched by wildcard rules
   */
  wildcardMatched: WildcardMappedFile[]

  /**
   * Files that were treated as optional (not matched to any rule)
   * Contains match attempt information
   *
   * Note: When optional mode is enabled, unmapped will always be empty
   * All non-matched files will appear here instead
   */
  optionalFiles: OptionalFile[]

  /**
   * Files that couldn't be matched to any rule
   * Will be EMPTY when optional mode is enabled
   */
  unmapped: UnmappedFile[]

  /**
   * Files that were excluded by preFilter criteria
   */
  preFiltered: PreFilteredFile[]

  /**
   * Statistics
   */
  stats: {
    totalFiles: number
    mappedFiles: number
    wildcardMatchedFiles: number
    unmappedFiles: number // Always 0 when mode='optional' or mode='strict-optional'
    optionalFiles: number // NEW
    preFilteredFiles: number
    totalRules: number
    mandatoryRules: number
    optionalRules: number
  }
}

/**
 * Request for filtering files
 */
export interface FilterRequest {
  /**
   * Files to be filtered
   */
  files: JsonFile[]

  /**
   * Matching rules in order (flat structure)
   * Can be a single rule or an array of rules (for flexible ordering)
   * Either 'rules' or 'groups' should be provided, not both
   */
  rules?: (MatchRule | MatchRule[])[]

  /**
   * Grouped rules with common filter criteria (hierarchical structure)
   * Either 'rules' or 'groups' should be provided, not both
   * NEW: Allows organizing rules by common criteria (e.g., by line number, event type)
   */
  groups?: FilterGroup[]

  /**
   * Sort function for ordering files before matching
   * @param a - First file
   * @param b - Second file
   * @returns Negative if a < b, positive if a > b, zero if equal
   */
  sortFn?: (a: JsonFile, b: JsonFile) => number

  /**
   * Optional pre-filter criteria that all files must match before rule/group matching
   * Files that don't match the pre-filter are excluded entirely (not added to unmapped)
   * Applied before group filters
   */
  preFilter?: FilterCriterion[]

  /**
   * Optional context for time-based filtering
   */
  context?: {
    startTimeScript?: string
    startTimeTest?: string
    pathTime?: PathElement[]
  }

  /**
   * Matching mode for handling files that don't match rules
   *
   * - 'strict' (default): Current behavior - all files must match a rule, non-matching → unmapped
   * - 'optional': Files that don't match any rule → optionalFiles (permissive mode)
   * - 'strict-optional': Only allow files as optional if they match an optional rule
   *
   * When 'optional' or 'strict-optional', unmapped will always be empty (all non-matched files go to optionalFiles)
   */
  mode?: 'strict' | 'strict-optional' | 'optional'
}
