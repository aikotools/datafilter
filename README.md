# @aikotools/datafilter

Advanced data filtering engine for JSON file matching in E2E testing.

[![npm version](https://badge.fury.io/js/@aikotools%2Fdatafilter.svg)](https://www.npmjs.com/package/@aikotools/datafilter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

`@aikotools/datafilter` provides sophisticated file filtering and matching capabilities specifically designed for E2E testing scenarios where you need to map actual result files to expected files.

### Key Features

- **Flexible Matching**: Match files using various filter criteria (value, exists, array checks, time ranges)
- **Order Handling**: Support for both strict and flexible ordering of expected files
- **🆕 Wildcard Optionals**: Match arbitrary number of optional files without explicit specification
- **Greedy vs. Non-Greedy**: Control whether wildcards match once or multiple times
- **PreFilter Support**: Global file filtering before rule matching
- **Group Filtering**: Organize files into groups with shared filter criteria
- **Deep Object Access**: Path-based navigation through nested JSON structures
- **Sort Integration**: Custom sort functions for file ordering before matching

## Installation

```bash
npm install @aikotools/datafilter
```

## Quick Start

```typescript
import { filterFiles } from '@aikotools/datafilter';

const result = filterFiles({
  files: [
    { fileName: 'event1.json', data: { type: 'event1', value: 42 } },
    { fileName: 'optional1.json', data: { type: 'optional' } },
    { fileName: 'optional2.json', data: { type: 'optional' } },
    { fileName: 'event2.json', data: { type: 'event2', value: 100 } },
  ],
  rules: [
    // Match specific file
    { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },

    // 🆕 NEW: Match arbitrary optionals with wildcard
    {
      matchAny: [{ path: ['type'], check: { value: 'optional' } }],
      optional: true,
      greedy: true, // Match all optionals
    },

    // Match another specific file
    { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
  ],
});

console.log(result.mapped.length); // 2 (event1, event2)
console.log(result.wildcardMatched.length); // 2 (both optionals)
console.log(result.unmapped.length); // 0
```

## Core Concepts

### Filter Criteria

All filter criteria use path-based access and various check types:

```typescript
{
  path: ['data', 'user', 'name'],  // Navigate through object
  check: { value: 'John' }         // Check type
}
```

### Match Rules

#### Single Match Rule

Maps exactly one file to an expected identifier:

```typescript
{
  match: [
    { path: ['type'], check: { value: 'event1' } },
    { path: ['status'], check: { value: 'active' } }
  ],
  expected: 'event1',
  optional: false  // Default: false
}
```

#### 🆕 Wildcard Match Rule (NEW)

Matches arbitrary number of files without explicit specification:

```typescript
{
  matchAny: [
    { path: ['category'], check: { value: 'optional' } }
  ],
  optional: true,   // Always true for wildcards
  greedy: true      // Match all (true) or just one (false)
}
```

#### Flexible Ordering

Use arrays of rules when order is not deterministic:

```typescript
[
  { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
  { match: [{ path: ['type'], check: { value: 'event4' } }], expected: 'event4' }
]
// Either event3 or event4 can come first
```

## Filter Check Types

### 1. Value Check

Deep equality comparison:

```typescript
{ path: ['user', 'name'], check: { value: 'John' } }
{ path: ['user', 'address'], check: { value: { city: 'Berlin', zip: '10115' } } }
```

### 2. Exists Check

Check if a path exists:

```typescript
{ path: ['optional', 'field'], check: { exists: true } }
{ path: ['deprecated'], check: { exists: false } }
```

### 3. Array Element Check

Check if array contains (or doesn't contain) an element:

```typescript
{ path: ['tags'], check: { itemExists: true, item: 'typescript' } }
{ path: ['status'], check: { itemExists: false, item: 'banned' } }
```

### 4. Array Size Check

Validate array length:

```typescript
{ path: ['items'], check: { type: 'equal', size: 3 } }
{ path: ['errors'], check: { type: 'lessThan', size: 5 } }
{ path: ['records'], check: { type: 'greaterThan', size: 10 } }
```

### 5. Time Range Check

Validate timestamps (ISO strings or numeric):

```typescript
// ISO timestamp
{
  path: ['timestamp'],
  check: {
    min: '2023-11-08T15:00:00+01:00',
    max: '2023-11-08T16:00:00+01:00'
  }
}

// Numeric timestamp (milliseconds)
{
  path: ['timestamp'],
  check: {
    min: '1699452000000',
    max: '1699455600000'
  }
}
```

## Advanced Features

### PreFilter - Global File Exclusion

PreFilter allows you to exclude files globally **before** any rule matching occurs. Files not matching the preFilter criteria are collected in the `preFiltered` property of the result, separate from `unmapped` files.

**Use Case:** Filter out irrelevant files (e.g., debug files, temporary files) before processing, while keeping track of what was excluded.

```typescript
const result = filterFiles({
  files: [
    { fileName: 'event1.json', data: { type: 'event', status: 'active', value: 42 } },
    { fileName: 'event2.json', data: { type: 'event', status: 'active', value: 100 } },
    { fileName: 'debug.json', data: { type: 'debug', status: 'inactive', value: 0 } },
    { fileName: 'temp.json', data: { type: 'temp', status: 'inactive', value: -1 } },
  ],
  preFilter: [
    // Only process files with status 'active'
    { path: ['status'], check: { value: 'active' } }
  ],
  rules: [
    { match: [{ path: ['type'], check: { value: 'event' } }], expected: 'event1' },
    { match: [{ path: ['type'], check: { value: 'event' } }], expected: 'event2' },
  ],
});

// Result:
// - mapped: event1.json, event2.json
// - preFiltered: debug.json, temp.json (with failed check details)
// - unmapped: []
```

### Group Filtering - Organize by Categories

Group filtering allows you to organize files into categories with shared filter criteria, then apply category-specific rules.

**Use Case:** Different file types (e.g., orders, invoices, reports) need different validation rules.

```typescript
import { filterFilesWithGroups } from '@aikotools/datafilter';

const result = filterFilesWithGroups({
  files: [
    { fileName: 'order1.json', data: { category: 'order', orderId: 'A123', amount: 100 } },
    { fileName: 'order2.json', data: { category: 'order', orderId: 'A124', amount: 200 } },
    { fileName: 'invoice1.json', data: { category: 'invoice', invoiceId: 'INV-001', total: 100 } },
    { fileName: 'invoice2.json', data: { category: 'invoice', invoiceId: 'INV-002', total: 200 } },
    { fileName: 'report.json', data: { category: 'report', month: 'January' } },
  ],
  groups: [
    {
      // Group 1: Orders
      groupFilter: [
        { path: ['category'], check: { value: 'order' } }
      ],
      rules: [
        { match: [{ path: ['orderId'], check: { value: 'A123' } }], expected: 'order_A123' },
        { match: [{ path: ['orderId'], check: { value: 'A124' } }], expected: 'order_A124' },
      ]
    },
    {
      // Group 2: Invoices
      groupFilter: [
        { path: ['category'], check: { value: 'invoice' } }
      ],
      rules: [
        { match: [{ path: ['invoiceId'], check: { value: 'INV-001' } }], expected: 'invoice_001' },
        { match: [{ path: ['invoiceId'], check: { value: 'INV-002' } }], expected: 'invoice_002' },
      ]
    },
    {
      // Group 3: Reports (with wildcard)
      groupFilter: [
        { path: ['category'], check: { value: 'report' } }
      ],
      rules: [
        { matchAny: [{ path: ['category'], check: { value: 'report' } }], optional: true, greedy: true }
      ]
    }
  ],
  preFilter: [
    // Optional: Only process files with specific structure
    { path: ['category'], check: { exists: true } }
  ]
});

// Result:
// - mapped: order_A123, order_A124, invoice_001, invoice_002
// - wildcardMatched: report.json
// - unmapped: []
```

### Combining PreFilter, Groups, and Wildcards

```typescript
const result = filterFilesWithGroups({
  files: allFiles,

  // Step 1: Global exclusion
  preFilter: [
    { path: ['status'], check: { value: 'active' } },
    { path: ['deleted'], check: { exists: false } }
  ],

  // Step 2: Group by type and apply rules
  groups: [
    {
      groupFilter: [{ path: ['type'], check: { value: 'critical' } }],
      rules: [
        { match: [{ path: ['priority'], check: { value: 1 } }], expected: 'critical_1' },
        { match: [{ path: ['priority'], check: { value: 2 } }], expected: 'critical_2' },
      ]
    },
    {
      groupFilter: [{ path: ['type'], check: { value: 'normal' } }],
      rules: [
        { matchAny: [{ path: ['type'], check: { value: 'normal' } }], optional: true, greedy: true }
      ]
    }
  ],

  sortFn: (a, b) => a.data.timestamp - b.data.timestamp
});
```

## Complete Example

### Scenario from Requirements

```
event1
    - event1.1 (optional)
event2
    - event3, event4 (flexible order)
event5
```

### Without Wildcard (Old Way)

Every optional file must be explicitly specified:

```typescript
const result = filterFiles({
  files: actualFiles,
  rules: [
    { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },
    { match: [{ path: ['type'], check: { value: 'event1.1' } }], expected: 'event1.1', optional: true },
    { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
    [
      { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      { match: [{ path: ['type'], check: { value: 'event4' } }], expected: 'event4' }
    ],
    { match: [{ path: ['type'], check: { value: 'event5' } }], expected: 'event5' },
  ],
});
```

### With Wildcard (New Way) 🆕

Arbitrary number of optional files without explicit specification:

```typescript
const result = filterFiles({
  files: actualFiles,
  rules: [
    { match: [{ path: ['type'], check: { value: 'event1' } }], expected: 'event1' },

    // 🆕 NEW: Match ANY number of optional files
    {
      matchAny: [{ path: ['category'], check: { value: 'optional' } }],
      optional: true,
      greedy: true
    },

    { match: [{ path: ['type'], check: { value: 'event2' } }], expected: 'event2' },
    [
      { match: [{ path: ['type'], check: { value: 'event3' } }], expected: 'event3' },
      { match: [{ path: ['type'], check: { value: 'event4' } }], expected: 'event4' }
    ],
    { match: [{ path: ['type'], check: { value: 'event5' } }], expected: 'event5' },
  ],
  sortFn: (a, b) => a.data.timestamp - b.data.timestamp
});

console.log(result.mapped); // event1, event2, event3, event4, event5
console.log(result.wildcardMatched); // All files matching optional criteria
console.log(result.unmapped); // Files that didn't match any rule
```

## API Reference

### filterFiles(request: FilterRequest): FilterResult

Main filtering function.

**FilterRequest:**
- `files: JsonFile[]` - Files to filter
- `rules: (MatchRule | MatchRule[])[]` - Matching rules
- `sortFn?: (a, b) => number` - Optional sort function
- `preFilter?: FilterCriterion[]` - Optional pre-filter criteria (files not matching are collected in `preFiltered`)
- `context?: { startTimeScript?, startTimeTest?, pathTime? }` - Optional context

**FilterResult:**
- `mapped: MappedFile[]` - Successfully mapped files
- `wildcardMatched: WildcardMappedFile[]` - Files matched by wildcards
- `unmapped: UnmappedFile[]` - Files that passed preFilter but couldn't be matched to any rule
- `preFiltered: PreFilteredFile[]` - Files excluded by preFilter criteria (with failed check details)
- `stats: { totalFiles, mappedFiles, wildcardMatchedFiles, unmappedFiles, preFilteredFiles, ... }`

### filterFilesWithGroups(request: FilterGroupRequest): FilterResult

Filtering with grouped rules for categorized file processing.

**FilterGroupRequest:**
- `files: JsonFile[]` - Files to filter
- `groups: FilterGroup[]` - Filter groups with common criteria and rules
- `sortFn?: (a, b) => number` - Optional sort function
- `preFilter?: FilterCriterion[]` - Optional pre-filter criteria (applied before group filtering)
- `context?: { startTimeScript?, startTimeTest?, pathTime? }` - Optional context

**FilterGroup:**
- `groupFilter: FilterCriterion[]` - Criteria to identify files belonging to this group
- `rules: (MatchRule | MatchRule[])[]` - Rules to apply to files in this group

**FilterResult:** Same as `filterFiles()`

### Matcher Class

For advanced usage with multiple filter operations:

```typescript
import { Matcher } from '@aikotools/datafilter';

const matcher = new Matcher({ startTimeScript, startTimeTest });

// With preFilter
const result = matcher.filterFiles(files, rules, sortFn, preFilter);

// With groups
const groupResult = matcher.filterFilesWithGroups(files, groups, sortFn, preFilter);
```

### FilterEngine Class

For custom filter criterion evaluation:

```typescript
import { FilterEngine } from '@aikotools/datafilter';

const engine = new FilterEngine();
const checkResult = engine.evaluateCriterion(data, criterion);
```

### Utility Functions

```typescript
import { getValueFromPath, pathExists, getValueOr } from '@aikotools/datafilter';

// Get value from path
const result = getValueFromPath(obj, ['data', 'user', 'name']);
// result: { value: 'John', found: true, validPath: ['data', 'user', 'name'] }

// Check if path exists
const exists = pathExists(obj, ['data', 'user']);
// exists: true

// Get value with default fallback
const value = getValueOr(obj, ['data', 'missing'], 'default');
// value: 'default'
```

## Migration from e2e-tool-util-result-mapper

### Key Differences

1. **Wildcard Support**: New wildcard rules eliminate need to specify every optional file
2. **Simpler API**: Focused on filtering, not entire pipeline (dedupe, sort, etc.)
3. **Type Safety**: Full TypeScript support with comprehensive types
4. **Modern Structure**: ESM modules, Vite build, Vitest testing

### Migration Example

**Old (result-mapper):**
```typescript
// Every optional must be explicitly specified
{
  "mappingCriteria": [
    { "expected": "event1.json", "optional": false, "filter": {...} },
    { "expected": "optional1.json", "optional": true, "filter": {...} },
    { "expected": "optional2.json", "optional": true, "filter": {...} },
    { "expected": "optional3.json", "optional": true, "filter": {...} },
    { "expected": "event2.json", "optional": false, "filter": {...} }
  ]
}
```

**New (datafilter):**
```typescript
// Wildcard matches all optionals
{
  rules: [
    { match: [...], expected: 'event1' },
    { matchAny: [...], optional: true, greedy: true }, // 🆕 All optionals
    { match: [...], expected: 'event2' }
  ]
}
```

## Test Results

✅ **21/21 tests passing**
- ✅ Basic filtering with single matches
- ✅ Flexible ordering (array of rules)
- ✅ Optional rules
- ✅ 🆕 Wildcard matches (greedy & non-greedy)
- ✅ All filter check types (value, exists, array, time)
- ✅ Complex real-world scenarios
- ✅ Sort function integration

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Format
npm run format
```

## Architecture

```
FilterEngine
├── Evaluates individual filter criteria
├── Supports: value, exists, array checks, time ranges
└── Deep equality comparison

Matcher
├── Orchestrates file-to-rule matching
├── Handles: single rules, arrays, wildcards
├── Tracks: matched files, exhausted rules
└── Produces detailed results

Utilities
└── Path-based object access (getValueFromPath, pathExists)
```

## License

MIT - See [LICENSE](LICENSE) file for details.

## Contributing

This is part of the @aikotools ecosystem. For issues and contributions, please see the repository.

---

**Built for E2E Testing** 🚀
