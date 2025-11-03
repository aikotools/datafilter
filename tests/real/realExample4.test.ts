import { beforeAll, describe, it, expect } from 'vitest'
import { filterFiles } from '../../src'
import type { JsonFile, MatchRule, FilterResult } from '../../src'
import * as fs from 'fs'
import * as path from 'path'

const VOLATILE = path.join(__dirname, '../volatile/real4')
const FIXTURES = path.join(__dirname, '../fixtures/real4')

beforeAll(async () => {
  await fs.promises.rm(VOLATILE, { recursive: true, force: true })
  await fs.promises.mkdir(VOLATILE, { recursive: true })
})

interface MessageMapExpected {
  mapped: Record<
    string,
    {
      optional: boolean
      messages: unknown[]
      info: {
        channelName?: string
        subCategory?: string
        trainNumbers?: string[]
        timestamp?: string
      }
    }
  >
  unexpected: unknown[]
  ignored: unknown[]
  channelName: string
  optionalFiles?: Array<{
    fileName: string
    position: number
    between?: {
      afterRule: string
      beforeRule: string
    }
  }>
}

function convertFilterResultToMessageMap(
  filterResult: FilterResult,
  channelName: string
): MessageMapExpected {
  const mapped: MessageMapExpected['mapped'] = {}

  // Convert mapped files to messageMap format
  for (const mappedFile of filterResult.mapped) {
    const key = `${channelName}/${mappedFile.expected}`

    mapped[key] = {
      optional: mappedFile.optional,
      messages: [mappedFile.file.data],
      info: mappedFile.info as MessageMapExpected['mapped'][string]['info'],
    }
  }

  return {
    mapped,
    unexpected: filterResult.unmapped.map(u => u.file.data),
    ignored: filterResult.preFiltered?.map(p => p.file.data) || [],
    channelName,
    optionalFiles: filterResult.optionalFiles?.map(opt => ({
      fileName: opt.fileName,
      position: opt.position,
      between: opt.between,
    })),
  }
}

/**
 * Das Problem hier ist das eines der events in dem flexible array ([Rule1, Rule2])
 * nicht gefunden wird und als optional zugeordnet wird.
 *
 * Expected behavior:
 * - 5 events sollten gemappt werden
 * - 3 events sollten als optionalFiles markiert werden
 * - Events in flexible arrays können in beliebiger Reihenfolge kommen
 */

describe('Real World Example - EventChannelV1 with flexible array rules', () => {
  it('should map real event files correctly including flexible array rules', () => {
    // Load grouped mapping criteria
    const criteriaPath = path.join(FIXTURES, 'mapCheck_criteria.json')
    const criteriaData: {
      channelName?: string
      mode?: string
      rules: (MatchRule | MatchRule[])[]
    } = JSON.parse(fs.readFileSync(criteriaPath, 'utf-8'))
    const rules = criteriaData.rules
    const mode = criteriaData.mode || 'strict'

    // Load all event files
    const eventsDir = path.join(FIXTURES, 'events')
    const eventFileNames = fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'))

    const files: JsonFile[] = eventFileNames.map(fileName => {
      const filePath = path.join(eventsDir, fileName)
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      return {
        fileName,
        data,
      }
    })

    console.log(`Loaded ${files.length} event files`)
    console.log(`Loaded ${rules.length} rules`)

    // Sort files by timestamp (from filename)
    const sortFn = (a: JsonFile, b: JsonFile) => {
      return a.fileName.localeCompare(b.fileName)
    }

    // Apply filter with rules
    console.log('\n=== Files before filtering ===')
    files.forEach((f, idx) => console.log(`${idx + 1}. ${f.fileName}`))
    console.log(`Mode: ${mode}`)

    const result = filterFiles({ files, rules, sortFn, mode: mode as 'strict' | 'optional' })

    console.log('\n=== All result properties ===')
    console.log('Keys:', Object.keys(result))

    console.log('\n=== Filtering Results ===')
    console.log(`Total files: ${result.stats.totalFiles}`)
    console.log(`Mapped files: ${result.stats.mappedFiles}`)
    console.log(`Wildcard matched: ${result.stats.wildcardMatchedFiles}`)
    console.log(`Unmapped files: ${result.stats.unmappedFiles}`)
    console.log(`Optional files: ${result.stats.optionalFiles}`)
    console.log(`DEBUG - mapped array length: ${result.mapped.length}`)
    console.log(`DEBUG - wildcardMatched array length: ${result.wildcardMatched?.length || 0}`)
    console.log(`DEBUG - unmapped array length: ${result.unmapped.length}`)
    console.log(`DEBUG - optionalFiles array length: ${result.optionalFiles?.length || 0}`)
    console.log(`DEBUG - preFiltered array length: ${result.preFiltered?.length || 0}`)
    const accountedFiles =
      result.mapped.length +
      (result.wildcardMatched?.length || 0) +
      result.unmapped.length +
      (result.optionalFiles?.length || 0) +
      (result.preFiltered?.length || 0)
    console.log(`DEBUG - Total accounted files: ${accountedFiles} (should be ${files.length})`)

    console.log('\n=== Mapped Files ===')
    result.mapped.forEach(m => {
      console.log(`${m.file.fileName} -> ${m.expected}`)
      console.log(`  Info:`, m.info)
    })

    if (result.unmapped.length > 0) {
      console.log('\n=== Unmapped Files ===')
      result.unmapped.forEach(u => {
        console.log(`${u.file.fileName}`)
        u.attemptedRules.forEach((attempt, idx) => {
          console.log(`  Attempt ${idx + 1}:`, attempt.rule)
          console.log(`  Checks:`)
          attempt.checks.forEach(check => {
            console.log(`    - ${check.checkType}: ${check.status ? 'PASS' : 'FAIL'}`)
            if (!check.status && check.reason) {
              console.log(`      Reason:`, check.reason)
            }
          })
        })
      })
    }

    if (result.optionalFiles && result.optionalFiles.length > 0) {
      console.log('\n=== Optional Files ===')
      result.optionalFiles.forEach(opt => {
        console.log(`${opt.fileName} at position ${opt.position}`)
        if (opt.between) {
          console.log(`  Between: ${opt.between.afterRule} -> ${opt.between.beforeRule}`)
        }
      })
    }

    // Write results to volatile directory
    const volatileDir = path.join(VOLATILE, 'results')
    fs.mkdirSync(volatileDir, { recursive: true })

    // Write full result
    const resultPath = path.join(volatileDir, 'filterResult.json')
    fs.writeFileSync(
      resultPath,
      JSON.stringify(
        {
          stats: result.stats,
          mapped: result.mapped.map(m => ({
            fileName: m.file.fileName,
            expected: m.expected,
            optional: m.optional,
            info: m.info,
            matchResult: {
              matched: m.matchResult.matched,
              checksCount: m.matchResult.checks.length,
              checks: m.matchResult.checks,
            },
          })),
          wildcardMatched: result.wildcardMatched.map(w => ({
            fileName: w.file.fileName,
            info: w.info,
          })),
          unmapped: result.unmapped.map(u => ({
            fileName: u.file.fileName,
            attemptedRulesCount: u.attemptedRules.length,
            attemptedRules: u.attemptedRules.map(a => ({
              matched: a.matched,
              checksCount: a.checks.length,
              checks: a.checks,
            })),
          })),
        },
        null,
        2
      )
    )

    // Write summary
    const summaryPath = path.join(volatileDir, 'summary.txt')
    const summaryLines = [
      '=== Real World Example - EventChannelV1 ===',
      '',
      `Total files: ${result.stats.totalFiles}`,
      `Mapped files: ${result.stats.mappedFiles}`,
      `Wildcard matched: ${result.stats.wildcardMatchedFiles}`,
      `Unmapped files: ${result.stats.unmappedFiles}`,
      '',
      '=== Mapped Files ===',
      ...result.mapped.map(m => `${m.file.fileName} -> ${m.expected} (${m.info?.subCategory})`),
    ]

    if (result.unmapped.length > 0) {
      summaryLines.push('', '=== Unmapped Files ===')
      summaryLines.push(...result.unmapped.map(u => u.file.fileName))
    }

    fs.writeFileSync(summaryPath, summaryLines.join('\n'))

    console.log(`\nResults written to:`)
    console.log(`  - ${resultPath}`)
    console.log(`  - ${summaryPath}`)

    // Load expected message map
    const expectedPath = path.join(FIXTURES, 'messageMap_expected.json')
    const expectedMessageMap: MessageMapExpected = JSON.parse(
      fs.readFileSync(expectedPath, 'utf-8')
    )

    // Convert filterResult to messageMap format
    const actualMessageMap = convertFilterResultToMessageMap(
      result,
      criteriaData.channelName || 'EventChannelV1'
    )

    // Write actual message map for comparison
    const messageMapPath = path.join(volatileDir, 'messageMap_actual.json')
    fs.writeFileSync(messageMapPath, JSON.stringify(actualMessageMap, null, 2))
    console.log(`  - ${messageMapPath}`)

    // Compare results
    console.log('\n=== Comparison with Expected ===')

    // Compare mapped files
    const expectedMappedKeys = Object.keys(expectedMessageMap.mapped).sort()
    const actualMappedKeys = Object.keys(actualMessageMap.mapped).sort()

    console.log(`Expected mapped: ${expectedMappedKeys.length}`)
    console.log(`Actual mapped: ${actualMappedKeys.length}`)

    // Compare optional files
    const expectedOptionalCount = expectedMessageMap.optionalFiles?.length || 0
    const actualOptionalCount = actualMessageMap.optionalFiles?.length || 0

    console.log(`Expected optional: ${expectedOptionalCount}`)
    console.log(`Actual optional: ${actualOptionalCount}`)

    // Verify counts
    expect(actualMappedKeys.length).toBe(expectedMappedKeys.length)
    expect(actualOptionalCount).toBe(expectedOptionalCount)

    // Verify all expected files are mapped
    for (const expectedKey of expectedMappedKeys) {
      expect(actualMappedKeys).toContain(expectedKey)
      console.log(`  ✓ ${expectedKey} mapped`)
    }

    // Verify optional files
    if (expectedOptionalCount > 0) {
      const expectedOptionalFileNames = expectedMessageMap
        .optionalFiles!.map(f => f.fileName)
        .sort()
      const actualOptionalFileNames = actualMessageMap.optionalFiles!.map(f => f.fileName).sort()

      expect(actualOptionalFileNames).toEqual(expectedOptionalFileNames)
      console.log(`  ✓ All ${expectedOptionalCount} optional files matched`)
    }
  })
})
