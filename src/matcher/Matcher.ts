import type {
  JsonFile,
  MatchRule,
  FilterResult,
  MappedFile,
  WildcardMappedFile,
  UnmappedFile,
  MatchResult,
  FilterCriterion,
  FilterGroup,
} from '../core/types';
import { isWildcardRule, isSingleMatchRule } from '../core/types';
import { FilterEngine } from '../engine/FilterEngine';

/**
 * Matcher system that matches files against rules.
 * Supports single matches, flexible ordering, and wildcard matches.
 */
export class Matcher {
  private engine: FilterEngine;

  constructor(context?: { startTimeScript?: string; startTimeTest?: string }) {
    this.engine = new FilterEngine(context);
  }

  /**
   * Matches a single file against a rule.
   *
   * @param file - The file to match
   * @param rule - The rule to match against
   * @returns MatchResult indicating if all criteria matched
   */
  matchFile(file: JsonFile, rule: MatchRule): MatchResult {
    const criteria = isWildcardRule(rule) ? rule.matchAny : rule.match;

    const checks = criteria.map(criterion => {
      return this.engine.evaluateCriterion(file.data, criterion);
    });

    const matched = checks.every(check => check.status);

    return {
      matched,
      checks,
      rule,
    };
  }

  /**
   * Applies pre-filter criteria to files, returning only files that match all criteria.
   *
   * @param files - Files to filter
   * @param preFilter - Filter criteria that all files must match
   * @returns Filtered files that match all preFilter criteria
   */
  private applyPreFilter(files: JsonFile[], preFilter: FilterCriterion[]): JsonFile[] {
    return files.filter(file => {
      const checks = preFilter.map(criterion => {
        return this.engine.evaluateCriterion(file.data, criterion);
      });
      return checks.every(check => check.status);
    });
  }

  /**
   * Main filtering function that processes files according to rules.
   *
   * @param files - Files to filter
   * @param rules - Matching rules (can include arrays for flexible ordering)
   * @param sortFn - Optional sort function for file ordering
   * @param preFilter - Optional pre-filter criteria (files not matching are excluded)
   * @returns FilterResult with mapped, wildcardMatched, and unmapped files
   */
  filterFiles(
    files: JsonFile[],
    rules: (MatchRule | MatchRule[])[],
    sortFn?: (a: JsonFile, b: JsonFile) => number,
    preFilter?: FilterCriterion[]
  ): FilterResult {
    // Apply pre-filter if provided
    const filteredFiles = preFilter ? this.applyPreFilter(files, preFilter) : files;

    // Sort files if sort function provided
    const sortedFiles = sortFn ? [...filteredFiles].sort(sortFn) : [...filteredFiles];

    const mapped: MappedFile[] = [];
    const wildcardMatched: WildcardMappedFile[] = [];
    const unmapped: UnmappedFile[] = [];

    // Track which files have been matched
    const matchedFileIndices = new Set<number>();

    // Track which flexible rules have been used
    const usedFlexibleRules = new Map<number, Set<number>>();

    let fileIndex = 0;
    let ruleIndex = 0;

    while (fileIndex < sortedFiles.length) {
      const file = sortedFiles[fileIndex];

      if (ruleIndex >= rules.length) {
        // No more rules - file is unmapped
        if (!matchedFileIndices.has(fileIndex)) {
          unmapped.push({
            file,
            attemptedRules: [],
          });
        }
        fileIndex++;
        continue;
      }

      const ruleOrRules = rules[ruleIndex];
      const attemptedMatches: MatchResult[] = [];
      let fileMatched = false;

      // Handle array of rules (flexible ordering)
      if (Array.isArray(ruleOrRules)) {
        // Try each rule in the array
        for (let subIndex = 0; subIndex < ruleOrRules.length; subIndex++) {
          // Check if this subrule was already used
          const used = usedFlexibleRules.get(ruleIndex)?.has(subIndex);
          if (used) {
            continue;
          }

          const rule = ruleOrRules[subIndex];
          const matchResult = this.matchFile(file, rule);
          attemptedMatches.push(matchResult);

          if (matchResult.matched && isSingleMatchRule(rule)) {
            // Mark this subrule as used
            if (!usedFlexibleRules.has(ruleIndex)) {
              usedFlexibleRules.set(ruleIndex, new Set());
            }
            usedFlexibleRules.get(ruleIndex)!.add(subIndex);

            mapped.push({
              expected: rule.expected,
              file,
              matchResult,
              optional: rule.optional || false,
              info: rule.info,
            });

            matchedFileIndices.add(fileIndex);
            fileMatched = true;
            break;
          }
        }

        // Check if all subrules are exhausted
        const allUsed = usedFlexibleRules.get(ruleIndex)?.size === ruleOrRules.length;
        if (allUsed) {
          ruleIndex++;
        }

        if (fileMatched) {
          fileIndex++;
        } else {
          // Try next file with same rule group
          fileIndex++;
        }
      } else {
        // Single rule
        const rule = ruleOrRules;
        const matchResult = this.matchFile(file, rule);
        attemptedMatches.push(matchResult);

        if (matchResult.matched) {
          if (isSingleMatchRule(rule)) {
            // Regular single match
            mapped.push({
              expected: rule.expected,
              file,
              matchResult,
              optional: rule.optional || false,
              info: rule.info,
            });

            matchedFileIndices.add(fileIndex);
            ruleIndex++;
            fileIndex++;
          } else if (isWildcardRule(rule)) {
            // Wildcard match
            wildcardMatched.push({
              file,
              matchResult,
              info: rule.info,
            });

            matchedFileIndices.add(fileIndex);

            if (rule.greedy) {
              // Stay on same rule, move to next file
              fileIndex++;
            } else {
              // Non-greedy: match once and move to next rule
              ruleIndex++;
              fileIndex++;
            }
          }
        } else {
          // No match
          if (rule.optional) {
            // Optional rule didn't match - skip to next rule
            ruleIndex++;
          } else if (isWildcardRule(rule)) {
            // Wildcard rule (always optional) didn't match - skip to next rule
            ruleIndex++;
          } else {
            // Mandatory rule didn't match - file is unmapped
            unmapped.push({
              file,
              attemptedRules: attemptedMatches,
            });
            fileIndex++;
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
      totalRules: this.countRules(rules),
      mandatoryRules: this.countMandatoryRules(rules),
      optionalRules: this.countOptionalRules(rules),
    };

    return {
      mapped,
      wildcardMatched,
      unmapped,
      stats,
    };
  }

  /**
   * Counts total number of rules (flattening arrays)
   */
  private countRules(rules: (MatchRule | MatchRule[])[]): number {
    return rules.reduce((count, rule) => {
      if (Array.isArray(rule)) {
        return count + rule.length;
      }
      return count + 1;
    }, 0);
  }

  /**
   * Counts mandatory rules
   */
  private countMandatoryRules(rules: (MatchRule | MatchRule[])[]): number {
    return rules.reduce((count, rule) => {
      if (Array.isArray(rule)) {
        return count + rule.filter(r => !r.optional && !isWildcardRule(r)).length;
      }
      return count + (rule.optional || isWildcardRule(rule) ? 0 : 1);
    }, 0);
  }

  /**
   * Counts optional rules
   */
  private countOptionalRules(rules: (MatchRule | MatchRule[])[]): number {
    return rules.reduce((count, rule) => {
      if (Array.isArray(rule)) {
        return count + rule.filter(r => r.optional || isWildcardRule(r)).length;
      }
      return count + (rule.optional || isWildcardRule(rule) ? 1 : 0);
    }, 0);
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
   * @returns FilterResult with mapped, wildcardMatched, and unmapped files
   */
  filterFilesWithGroups(
    files: JsonFile[],
    groups: FilterGroup[],
    sortFn?: (a: JsonFile, b: JsonFile) => number,
    preFilter?: FilterCriterion[]
  ): FilterResult {
    // Apply pre-filter if provided
    const preFilteredFiles = preFilter ? this.applyPreFilter(files, preFilter) : files;

    // Sort files if sort function provided
    const sortedFiles = sortFn ? [...preFilteredFiles].sort(sortFn) : [...preFilteredFiles];

    const mapped: MappedFile[] = [];
    const wildcardMatched: WildcardMappedFile[] = [];
    const unmapped: UnmappedFile[] = [];

    // Process each group
    for (const group of groups) {
      // Find files that match this group's filter
      const groupFiles = sortedFiles.filter(file => {
        const checks = group.groupFilter.map(criterion => {
          return this.engine.evaluateCriterion(file.data, criterion);
        });
        return checks.every(check => check.status);
      });

      if (groupFiles.length === 0) {
        // No files match this group - continue to next group
        continue;
      }

      // Apply the group's rules to the matched files
      // Convert rules to the format expected by filterFiles
      const rulesArray: (MatchRule | MatchRule[])[] = group.rules.map(rule => {
        if (Array.isArray(rule)) {
          return rule;
        }
        return rule;
      });

      // Use the existing filterFiles logic (without preFilter, already applied)
      const groupResult = this.filterFiles(groupFiles, rulesArray);

      // Merge results
      mapped.push(...groupResult.mapped);
      wildcardMatched.push(...groupResult.wildcardMatched);
      unmapped.push(...groupResult.unmapped);
    }

    // Calculate total rules across all groups
    const allRules = groups.flatMap(g => g.rules);
    const stats = {
      totalFiles: files.length,
      mappedFiles: mapped.length,
      wildcardMatchedFiles: wildcardMatched.length,
      unmappedFiles: unmapped.length,
      totalRules: this.countRules(allRules),
      mandatoryRules: this.countMandatoryRules(allRules),
      optionalRules: this.countOptionalRules(allRules),
    };

    return {
      mapped,
      wildcardMatched,
      unmapped,
      stats,
    };
  }
}
