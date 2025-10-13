import { describe, it } from 'vitest';
import { filterFiles } from '../../src';
import type { JsonFile, FilterGroup } from '../../src';
import * as fs from 'fs';
import * as path from 'path';

describe('Real World Example - RiFahrtV1', () => {
  it('should map real event files using grouped mapping criteria', () => {
    // Load grouped mapping criteria
    const criteriaPath = path.join(__dirname, '../fixtures/real/mapping_criteria_grouped.json');
    const groups: FilterGroup[] = JSON.parse(fs.readFileSync(criteriaPath, 'utf-8'));

    // Load all event files
    const eventsDir = path.join(__dirname, '../fixtures/real/events');
    const eventFileNames = fs.readdirSync(eventsDir).filter(f => f.endsWith('.json'));

    const files: JsonFile[] = eventFileNames.map(fileName => {
      const filePath = path.join(eventsDir, fileName);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return {
        fileName,
        data,
      };
    });

    console.log(`Loaded ${files.length} event files`);
    console.log(`Loaded ${groups.length} filter groups`);
    console.log(`Total rules across groups: ${groups.reduce((sum, g) => sum + g.rules.length, 0)}`);

    // Sort files by timestamp (from filename)
    const sortFn = (a: JsonFile, b: JsonFile) => {
      return a.fileName.localeCompare(b.fileName);
    };

    // Apply filter with groups
    const result = filterFiles({ files, groups, sortFn });

    console.log('\n=== Filtering Results ===');
    console.log(`Total files: ${result.stats.totalFiles}`);
    console.log(`Mapped files: ${result.stats.mappedFiles}`);
    console.log(`Wildcard matched: ${result.stats.wildcardMatchedFiles}`);
    console.log(`Unmapped files: ${result.stats.unmappedFiles}`);

    console.log('\n=== Mapped Files ===');
    result.mapped.forEach(m => {
      console.log(`${m.file.fileName} -> ${m.expected}`);
      console.log(`  Info:`, m.info);
    });

    if (result.unmapped.length > 0) {
      console.log('\n=== Unmapped Files ===');
      result.unmapped.forEach(u => {
        console.log(`${u.file.fileName}`);
        u.attemptedRules.forEach((attempt, idx) => {
          console.log(`  Attempt ${idx + 1}:`, attempt.rule);
          console.log(`  Checks:`);
          attempt.checks.forEach(check => {
            console.log(`    - ${check.checkType}: ${check.status ? 'PASS' : 'FAIL'}`);
            if (!check.status && check.reason) {
              console.log(`      Reason:`, check.reason);
            }
          });
        });
      });
    }

    // Write results to volatile directory
    const volatileDir = path.join(__dirname, '../volatile/real');
    fs.mkdirSync(volatileDir, { recursive: true });

    // Write full result
    const resultPath = path.join(volatileDir, 'filterResult.json');
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
    );

    // Write summary
    const summaryPath = path.join(volatileDir, 'summary.txt');
    const summaryLines = [
      '=== Real World Example - RiFahrtV1 ===',
      '',
      `Total files: ${result.stats.totalFiles}`,
      `Mapped files: ${result.stats.mappedFiles}`,
      `Wildcard matched: ${result.stats.wildcardMatchedFiles}`,
      `Unmapped files: ${result.stats.unmappedFiles}`,
      '',
      '=== Mapped Files ===',
      ...result.mapped.map(m => `${m.file.fileName} -> ${m.expected} (${m.info?.subCategory})`),
    ];

    if (result.unmapped.length > 0) {
      summaryLines.push('', '=== Unmapped Files ===');
      summaryLines.push(...result.unmapped.map(u => u.file.fileName));
    }

    fs.writeFileSync(summaryPath, summaryLines.join('\n'));

    console.log(`\nResults written to:`);
    console.log(`  - ${resultPath}`);
    console.log(`  - ${summaryPath}`);
  });
});
