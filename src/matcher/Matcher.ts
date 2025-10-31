import type {
  JsonFile,
  MatchRule,
  FilterResult,
  MappedFile,
  WildcardMappedFile,
  UnmappedFile,
  OptionalFile,
  PreFilteredFile,
  MatchResult,
  FilterCriterion,
  FilterGroup,
} from '../core/types'
import { isWildcardRule, isSingleMatchRule } from '../core/types'
import { FilterEngine } from '../engine/FilterEngine'

/**
 * Matcher system that matches files against rules.
 * Supports single matches, flexible ordering, and wildcard matches.
 */
export class Matcher {
  private engine: FilterEngine

  constructor(context?: { startTimeScript?: string; startTimeTest?: string }) {
    this.engine = new FilterEngine(context)
  }

  /**
   * Matches a single file against a rule.
   *
   * @param file - The file to match
   * @param rule - The rule to match against
   * @returns MatchResult indicating if all criteria matched
   */
  matchFile(file: JsonFile, rule: MatchRule): MatchResult {
    const criteria = isWildcardRule(rule) ? rule.matchAny : rule.match

    const checks = criteria.map(criterion => {
      return this.engine.evaluateCriterion(file.data, criterion)
    })

    const matched = checks.every(check => check.status)

    return {
      matched,
      checks,
      rule,
    }
  }

  /**
   * Applies pre-filter criteria to files, separating files that match from those that don't.
   *
   * @param files - Files to filter
   * @param preFilter - Filter criteria that all files must match
   * @returns Object with matched files and excluded files (with failed checks)
   */
  private applyPreFilter(
    files: JsonFile[],
    preFilter: FilterCriterion[]
  ): {
    matched: JsonFile[]
    excluded: PreFilteredFile[]
  } {
    const matched: JsonFile[] = []
    const excluded: PreFilteredFile[] = []

    for (const file of files) {
      const checks = preFilter.map(criterion => {
        return this.engine.evaluateCriterion(file.data, criterion)
      })

      if (checks.every(check => check.status)) {
        matched.push(file)
      } else {
        excluded.push({
          file,
          failedChecks: checks.filter(check => !check.status),
        })
      }
    }

    return { matched, excluded }
  }

  /**
   * Main filtering function that processes files according to rules.
   *
   * @param files - Files to filter
   * @param rules - Matching rules (can include arrays for flexible ordering)
   * @param sortFn - Optional sort function for file ordering
   * @param preFilter - Optional pre-filter criteria (files not matching are excluded)
   * @param mode - Matching mode ('strict', 'optional', or 'strict-optional')
   * @returns FilterResult with mapped, wildcardMatched, optionalFiles and unmapped files
   */
  filterFiles(
    files: JsonFile[],
    rules: (MatchRule | MatchRule[])[],
    sortFn?: (a: JsonFile, b: JsonFile) => number,
    preFilter?: FilterCriterion[],
    mode: 'strict' | 'strict-optional' | 'optional' = 'strict'
  ): FilterResult {
    // Apply pre-filter if provided
    let filteredFiles: JsonFile[]
    let preFiltered: PreFilteredFile[] = []

    if (preFilter) {
      const preFilterResult = this.applyPreFilter(files, preFilter)
      filteredFiles = preFilterResult.matched
      preFiltered = preFilterResult.excluded
    } else {
      filteredFiles = files
    }

    // Sort files if sort function provided
    const sortedFiles = sortFn ? [...filteredFiles].sort(sortFn) : [...filteredFiles]

    const mapped: MappedFile[] = []
    const wildcardMatched: WildcardMappedFile[] = []
    const unmapped: UnmappedFile[] = []
    const optionalFiles: OptionalFile[] = []

    // Track which files have been matched
    const matchedFileIndices = new Set<number>()

    // For optional modes, use scan-forward algorithm
    if (mode === 'optional' || mode === 'strict-optional') {
      return this.filterFilesOptionalMode(sortedFiles, rules, preFiltered, files.length, mode)
    }

    // Track which flexible rules have been used
    const usedFlexibleRules = new Map<number, Set<number>>()

    // Track which standalone rules have been used (to ensure each rule matches only once)
    const usedStandaloneRules = new Set<number>()

    let fileIndex = 0
    let ruleIndex = 0

    while (fileIndex < sortedFiles.length) {
      const file = sortedFiles[fileIndex]

      if (ruleIndex >= rules.length) {
        // No more rules - file is unmapped
        if (!matchedFileIndices.has(fileIndex)) {
          unmapped.push({
            file,
            attemptedRules: [],
          })
        }
        fileIndex++
        continue
      }

      const ruleOrRules = rules[ruleIndex]
      const attemptedMatches: MatchResult[] = []
      let fileMatched = false

      // Handle array of rules (flexible ordering)
      if (Array.isArray(ruleOrRules)) {
        // Try each rule in the array
        for (let subIndex = 0; subIndex < ruleOrRules.length; subIndex++) {
          // Check if this subrule was already used
          const used = usedFlexibleRules.get(ruleIndex)?.has(subIndex)
          if (used) {
            continue
          }

          const rule = ruleOrRules[subIndex]
          const matchResult = this.matchFile(file, rule)
          attemptedMatches.push(matchResult)

          if (matchResult.matched && isSingleMatchRule(rule)) {
            // Mark this subrule as used
            if (!usedFlexibleRules.has(ruleIndex)) {
              usedFlexibleRules.set(ruleIndex, new Set())
            }
            const usedSet = usedFlexibleRules.get(ruleIndex)
            if (usedSet) {
              usedSet.add(subIndex)
            }

            mapped.push({
              expected: rule.expected,
              file,
              matchResult,
              optional: rule.optional || false,
              info: rule.info,
            })

            matchedFileIndices.add(fileIndex)
            fileMatched = true
            break
          }
        }

        // Check if all subrules are exhausted
        const allUsed = usedFlexibleRules.get(ruleIndex)?.size === ruleOrRules.length
        if (allUsed) {
          ruleIndex++
        }

        if (fileMatched) {
          fileIndex++
        } else {
          // File didn't match any rule in the group
          // Check if this is a mandatory group (at least one non-optional rule)
          const hasMandatoryRule = ruleOrRules.some(r => isSingleMatchRule(r) && !r.optional)

          if (hasMandatoryRule) {
            // Add file to unmapped since it didn't match a mandatory group
            unmapped.push({
              file,
              attemptedRules: attemptedMatches,
            })
          }

          // Try next file with same rule group
          fileIndex++
        }
      } else {
        // Single rule
        const rule = ruleOrRules

        // Check if this standalone single match rule has already been used
        if (isSingleMatchRule(rule) && usedStandaloneRules.has(ruleIndex)) {
          // This rule was already matched - skip to next rule
          ruleIndex++
          continue
        }

        const matchResult = this.matchFile(file, rule)
        attemptedMatches.push(matchResult)

        if (matchResult.matched) {
          if (isSingleMatchRule(rule)) {
            // Regular single match
            mapped.push({
              expected: rule.expected,
              file,
              matchResult,
              optional: rule.optional || false,
              info: rule.info,
            })

            matchedFileIndices.add(fileIndex)
            // Mark this standalone rule as used
            usedStandaloneRules.add(ruleIndex)
            ruleIndex++
            fileIndex++
          } else if (isWildcardRule(rule)) {
            // Wildcard match
            wildcardMatched.push({
              file,
              matchResult,
              info: rule.info,
            })

            matchedFileIndices.add(fileIndex)

            if (rule.greedy) {
              // Stay on same rule, move to next file
              fileIndex++
            } else {
              // Non-greedy: match once and move to next rule
              ruleIndex++
              fileIndex++
            }
          }
        } else {
          // No match
          if (rule.optional) {
            // Optional rule didn't match - skip to next rule
            ruleIndex++
          } else if (isWildcardRule(rule)) {
            // Wildcard rule (always optional) didn't match - skip to next rule
            ruleIndex++
          } else {
            // Mandatory rule didn't match - file is unmapped
            unmapped.push({
              file,
              attemptedRules: attemptedMatches,
            })
            fileIndex++
          }
        }
      }
    }

    // Generate statistics
    const stats = {
      totalFiles: files.length,
      mappedFiles: mapped.length,
      wildcardMatchedFiles: wildcardMatched.length,
      unmappedFiles: unmapped.length,
      optionalFiles: optionalFiles.length,
      preFilteredFiles: preFiltered.length,
      totalRules: this.countRules(rules),
      mandatoryRules: this.countMandatoryRules(rules),
      optionalRules: this.countOptionalRules(rules),
    }

    return {
      mapped,
      wildcardMatched,
      optionalFiles,
      unmapped,
      preFiltered,
      stats,
    }
  }

  /**
   * Filtering with optional mode - uses scan-forward algorithm
   */
  private filterFilesOptionalMode(
    sortedFiles: JsonFile[],
    rules: (MatchRule | MatchRule[])[],
    preFiltered: PreFilteredFile[],
    totalFiles: number,
    mode: 'optional' | 'strict-optional'
  ): FilterResult {
    const mapped: MappedFile[] = []
    const wildcardMatched: WildcardMappedFile[] = []
    const optionalFiles: OptionalFile[] = []

    // Track which standalone single match rules have been used in flexible arrays
    const usedFlexibleRules = new Map<number, Set<number>>()

    let currentFileIndex = 0
    let lastMatchedIndex = -1
    let lastMatchedRule: string | null = null

    for (let ruleIndex = 0; ruleIndex < rules.length; ruleIndex++) {
      const ruleOrRules = rules[ruleIndex]
      let found = false

      // Scan forward from current position to find a matching file
      for (let fileIndex = currentFileIndex; fileIndex < sortedFiles.length; fileIndex++) {
        const file = sortedFiles[fileIndex]

        // Try to match against this rule
        let matchResult: MatchResult | null = null
        let matchedRule: MatchRule | null = null

        if (Array.isArray(ruleOrRules)) {
          // Try each rule in the flexible array
          for (let subRuleIndex = 0; subRuleIndex < ruleOrRules.length; subRuleIndex++) {
            const rule = ruleOrRules[subRuleIndex]

            // Check if this subrule was already used
            if (isSingleMatchRule(rule)) {
              const usedSubRules = usedFlexibleRules.get(ruleIndex)
              if (usedSubRules && usedSubRules.has(subRuleIndex)) {
                // This subrule was already used, skip it
                continue
              }
            }

            const result = this.matchFile(file, rule)
            if (result.matched) {
              matchResult = result
              matchedRule = rule

              // Mark this subrule as used if it's a single match rule
              if (isSingleMatchRule(rule)) {
                if (!usedFlexibleRules.has(ruleIndex)) {
                  usedFlexibleRules.set(ruleIndex, new Set())
                }
                usedFlexibleRules.get(ruleIndex)!.add(subRuleIndex)
              }

              break
            }
          }
        } else {
          matchResult = this.matchFile(file, ruleOrRules)
          if (matchResult.matched) {
            matchedRule = ruleOrRules
          }
        }

        if (matchResult && matchResult.matched && matchedRule) {
          // Found a match! Mark all files between last match and this match as optional
          for (let i = lastMatchedIndex + 1; i < fileIndex; i++) {
            const optionalFile = sortedFiles[i]
            optionalFiles.push({
              fileName: optionalFile.fileName,
              position: i,
              between: {
                afterRule: lastMatchedRule || '(start)',
                beforeRule: isSingleMatchRule(matchedRule) ? matchedRule.expected : '(wildcard)',
              },
              failedMatches: [], // TODO: collect actual failed matches
            })
          }

          // Add the matched file
          if (isSingleMatchRule(matchedRule)) {
            mapped.push({
              expected: matchedRule.expected,
              file,
              matchResult,
              optional: matchedRule.optional || false,
              info: matchedRule.info,
            })
            lastMatchedRule = matchedRule.expected
          } else if (isWildcardRule(matchedRule)) {
            wildcardMatched.push({
              file,
              matchResult,
              info: matchedRule.info,
            })
            lastMatchedRule = '(wildcard)'
          }

          lastMatchedIndex = fileIndex
          currentFileIndex = fileIndex + 1
          found = true
          break
        }
      }

      // If rule not found and it's mandatory, that's an error in strict-optional mode
      if (!found) {
        const isMandatory = Array.isArray(ruleOrRules)
          ? ruleOrRules.some(r => !r.optional && !isWildcardRule(r))
          : !ruleOrRules.optional && !isWildcardRule(ruleOrRules)

        if (isMandatory && mode === 'strict-optional') {
          // In strict-optional mode, failing to find a mandatory rule is still an error
          // But we mark remaining files as optional
          break
        }
        // In pure optional mode, we just continue
      }
    }

    // Mark all remaining files as optional
    for (let i = lastMatchedIndex + 1; i < sortedFiles.length; i++) {
      const optionalFile = sortedFiles[i]
      optionalFiles.push({
        fileName: optionalFile.fileName,
        position: i,
        between: {
          afterRule: lastMatchedRule || '(start)',
          beforeRule: '(end)',
        },
        failedMatches: [], // TODO: collect actual failed matches
      })
    }

    const stats = {
      totalFiles,
      mappedFiles: mapped.length,
      wildcardMatchedFiles: wildcardMatched.length,
      unmappedFiles: 0, // Always 0 in optional modes
      optionalFiles: optionalFiles.length,
      preFilteredFiles: preFiltered.length,
      totalRules: this.countRules(rules),
      mandatoryRules: this.countMandatoryRules(rules),
      optionalRules: this.countOptionalRules(rules),
    }

    return {
      mapped,
      wildcardMatched,
      optionalFiles,
      unmapped: [], // Always empty in optional modes
      preFiltered,
      stats,
    }
  }

  /**
   * Counts total number of rules (flattening arrays)
   */
  private countRules(rules: (MatchRule | MatchRule[])[]): number {
    return rules.reduce((count, rule) => {
      if (Array.isArray(rule)) {
        return count + rule.length
      }
      return count + 1
    }, 0)
  }

  /**
   * Counts mandatory rules
   */
  private countMandatoryRules(rules: (MatchRule | MatchRule[])[]): number {
    return rules.reduce((count, rule) => {
      if (Array.isArray(rule)) {
        return count + rule.filter(r => !r.optional && !isWildcardRule(r)).length
      }
      return count + (rule.optional || isWildcardRule(rule) ? 0 : 1)
    }, 0)
  }

  /**
   * Counts optional rules
   */
  private countOptionalRules(rules: (MatchRule | MatchRule[])[]): number {
    return rules.reduce((count, rule) => {
      if (Array.isArray(rule)) {
        return count + rule.filter(r => r.optional || isWildcardRule(r)).length
      }
      return count + (rule.optional || isWildcardRule(rule) ? 1 : 0)
    }, 0)
  }

  /**
   * Filtering function for grouped rules with common filter criteria.
   * Files are first filtered by preFilter (if provided), then matched against
   * group filters, and finally processed by the group's rules.
   *
   * @param files - Files to filter
   * @param groups - Filter groups with common criteria and rules
   * @param sortFn - Optional sort function for file ordering
   * @param preFilter - Optional pre-filter criteria (files not matching are excluded)
   * @param mode - Matching mode ('strict', 'optional', or 'strict-optional')
   * @returns FilterResult with mapped, wildcardMatched, optionalFiles and unmapped files
   */
  filterFilesWithGroups(
    files: JsonFile[],
    groups: FilterGroup[],
    sortFn?: (a: JsonFile, b: JsonFile) => number,
    preFilter?: FilterCriterion[],
    mode: 'strict' | 'strict-optional' | 'optional' = 'strict'
  ): FilterResult {
    // Apply pre-filter if provided
    let filteredFiles: JsonFile[]
    let preFiltered: PreFilteredFile[] = []

    if (preFilter) {
      const preFilterResult = this.applyPreFilter(files, preFilter)
      filteredFiles = preFilterResult.matched
      preFiltered = preFilterResult.excluded
    } else {
      filteredFiles = files
    }

    // Sort files if sort function provided
    const sortedFiles = sortFn ? [...filteredFiles].sort(sortFn) : [...filteredFiles]

    const mapped: MappedFile[] = []
    const wildcardMatched: WildcardMappedFile[] = []
    const unmapped: UnmappedFile[] = []
    const optionalFiles: OptionalFile[] = []

    // Process each group
    for (const group of groups) {
      // Find files that match this group's filter
      const groupFiles = sortedFiles.filter(file => {
        const checks = group.groupFilter.map(criterion => {
          return this.engine.evaluateCriterion(file.data, criterion)
        })
        return checks.every(check => check.status)
      })

      if (groupFiles.length === 0) {
        // No files match this group - continue to next group
        continue
      }

      // Apply the group's rules to the matched files
      // Convert rules to the format expected by filterFiles
      const rulesArray: (MatchRule | MatchRule[])[] = group.rules.map(rule => {
        if (Array.isArray(rule)) {
          return rule
        }
        return rule
      })

      // Use the existing filterFiles logic (without preFilter, already applied)
      const groupResult = this.filterFiles(groupFiles, rulesArray, undefined, undefined, mode)

      // Merge results
      mapped.push(...groupResult.mapped)
      wildcardMatched.push(...groupResult.wildcardMatched)
      unmapped.push(...groupResult.unmapped)
      optionalFiles.push(...groupResult.optionalFiles)
    }

    // Calculate total rules across all groups
    const allRules = groups.flatMap(g => g.rules)
    const stats = {
      totalFiles: files.length,
      mappedFiles: mapped.length,
      wildcardMatchedFiles: wildcardMatched.length,
      unmappedFiles: unmapped.length,
      optionalFiles: optionalFiles.length,
      preFilteredFiles: preFiltered.length,
      totalRules: this.countRules(allRules),
      mandatoryRules: this.countMandatoryRules(allRules),
      optionalRules: this.countOptionalRules(allRules),
    }

    return {
      mapped,
      wildcardMatched,
      optionalFiles,
      unmapped,
      preFiltered,
      stats,
    }
  }
}
