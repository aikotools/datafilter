# @aikotools/datafilter

Advanced data filtering engine for JSON file matching in E2E testing.

[![npm version](https://badge.fury.io/js/@aikotools%2Fdatafilter.svg)](https://www.npmjs.com/package/@aikotools/datafilter)
[![License: DBISL](https://img.shields.io/badge/License-DBISL-blue.svg)](LICENSE)

## Overview

`@aikotools/datafilter` provides sophisticated file filtering and matching capabilities specifically designed for E2E testing scenarios where you need to map actual result files to expected files.

### Key Features

- **Flexible Matching**: Match files using various filter criteria (value, exists, array checks, time ranges)
- **Order Handling**: Support for both strict and flexible ordering of expected files
- **🆕 Wildcard Optionals**: Match arbitrary number of optional files without explicit specification
- **Greedy vs. Non-Greedy**: Control whether wildcards match once or multiple times
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
- `context?: { startTimeScript?, startTimeTest?, pathTime? }` - Optional context

**FilterResult:**
- `mapped: MappedFile[]` - Successfully mapped files
- `wildcardMatched: WildcardMappedFile[]` - Files matched by wildcards
- `unmapped: UnmappedFile[]` - Files that couldn't be matched
- `stats: { totalFiles, mappedFiles, wildcardMatchedFiles, unmappedFiles, ... }`

### Matcher Class

For advanced usage with multiple filter operations:

```typescript
import { Matcher } from '@aikotools/datafilter';

const matcher = new Matcher({ startTimeScript, startTimeTest });
const result = matcher.filterFiles(files, rules, sortFn);
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

DBISL

## Contributing

This is part of the @aikotools ecosystem. For issues and contributions, please see the repository.

---

**Built for E2E Testing** 🚀
