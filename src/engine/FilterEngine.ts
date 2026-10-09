import { DateTime } from 'luxon'
import type {
  FilterCriterion,
  FilterCheckResult,
  CheckValue,
  CheckExists,
  CheckArrayElement,
  CheckArraySize,
  CheckTimeRange,
  CheckNumericRange,
  CheckOneOf,
} from '../core/types'
import { expandWildcardPaths, getValueFromPath, hasWildcard } from '../utils/ObjectAccess'

/**
 * Filter engine that evaluates filter criteria against data objects.
 * Provides various check methods for different types of comparisons.
 */
export class FilterEngine {
  /**
   * Context for time-based filtering
   */
  private context?: {
    startTimeScript?: string
    startTimeTest?: string
  }

  constructor(context?: { startTimeScript?: string; startTimeTest?: string }) {
    this.context = context
  }

  /**
   * Evaluates a single filter criterion against a data object.
   *
   * When the path contains a wildcard (`'*'`), it is expanded into every concrete path that
   * exists in the data and the criterion is evaluated against each of them. The criterion
   * passes as soon as **one** concrete path satisfies the check — a wildcard therefore reads
   * as "any entry at this position".
   *
   * This is what makes a criterion independent of keys that the producer assigns. A protobuf
   * map is keyed by an id chosen by the sender; addressing it by that id ties the criterion to
   * a number nobody controls.
   *
   * @param data - The data object to check
   * @param criterion - The filter criterion to evaluate
   * @returns FilterCheckResult indicating success or failure
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluateCriterion(data: any, criterion: FilterCriterion): FilterCheckResult {
    if (hasWildcard(criterion.path)) {
      return this.evaluateWildcardCriterion(data, criterion)
    }
    return this.evaluateConcreteCriterion(data, criterion)
  }

  /**
   * Evaluates a criterion whose path contains a wildcard.
   *
   * Fails with a single reason when no concrete path exists, and with the reason of the last
   * attempt when concrete paths exist but none satisfies the check. The number of attempts is
   * part of the reason so a failure can be told apart from "nothing to check".
   */
  private evaluateWildcardCriterion(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    criterion: FilterCriterion
  ): FilterCheckResult {
    const paths = expandWildcardPaths(data, criterion.path)

    if (paths.length === 0) {
      return {
        status: false,
        checkType: 'wildcard',
        reason: {
          message: 'No path matches the wildcard',
          path: criterion.path,
        },
      }
    }

    let last: FilterCheckResult | undefined
    for (const path of paths) {
      const result = this.evaluateConcreteCriterion(data, { ...criterion, path })
      if (result.status) {
        return result
      }
      last = result
    }

    return {
      status: false,
      checkType: last?.checkType ?? 'wildcard',
      reason: {
        message: `No entry matches (${paths.length} checked)`,
        path: criterion.path,
        lastAttempt: last?.reason,
      },
    }
  }

  /**
   * Evaluates a criterion against one concrete path.
   *
   * @param data - The data object to check
   * @param criterion - The filter criterion, its path free of wildcards
   * @returns FilterCheckResult indicating success or failure
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private evaluateConcreteCriterion(data: any, criterion: FilterCriterion): FilterCheckResult {
    const check = criterion.check

    // Determine check type and delegate to appropriate method
    if ('value' in check) {
      return this.checkValue(data, criterion.path, check as CheckValue)
    }

    if ('exists' in check) {
      return this.checkExists(data, criterion.path, check as CheckExists)
    }

    if ('itemExists' in check && 'item' in check) {
      return this.checkArrayElement(data, criterion.path, check as CheckArrayElement)
    }

    if ('type' in check && 'size' in check) {
      return this.checkArraySize(data, criterion.path, check as CheckArraySize)
    }

    if ('min' in check && 'max' in check) {
      // Distinguish between numeric and time ranges based on type
      if (typeof check.min === 'number' && typeof check.max === 'number') {
        return this.checkNumericRange(data, criterion.path, check as CheckNumericRange)
      } else {
        return this.checkTimeRange(data, criterion.path, check as CheckTimeRange)
      }
    }

    if ('oneOf' in check) {
      return this.checkOneOf(data, criterion.path, check as CheckOneOf)
    }

    return {
      status: false,
      checkType: 'unknown',
      reason: `Unknown check type: ${JSON.stringify(check)}`,
    }
  }

  /**
   * Checks if a value matches an expected value using deep equality.
   *
   * @param data - The data object
   * @param path - Path to the value
   * @param check - The value check specification
   * @returns FilterCheckResult
   */
  private checkValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    path: (string | number)[],
    check: CheckValue
  ): FilterCheckResult {
    const accessResult = getValueFromPath(data, path)

    if (!accessResult.found) {
      return {
        status: false,
        checkType: 'checkValue',
        reason: {
          message: accessResult.error || 'Path not found',
          path,
        },
      }
    }

    const actual = accessResult.value
    const expected = check.value

    if (this.deepEqual(actual, expected)) {
      return {
        status: true,
        checkType: 'checkValue',
      }
    }

    return {
      status: false,
      checkType: 'checkValue',
      reason: {
        message: 'Value mismatch',
        path,
        expected,
        actual,
      },
    }
  }

  /**
   * Checks if a path exists in the data object.
   *
   * @param data - The data object
   * @param path - Path to check
   * @param check - The exists check specification
   * @returns FilterCheckResult
   */
  private checkExists(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    path: (string | number)[],
    check: CheckExists
  ): FilterCheckResult {
    const accessResult = getValueFromPath(data, path)
    const exists = accessResult.found && accessResult.value !== undefined

    if (check.exists === exists) {
      return {
        status: true,
        checkType: 'checkExists',
      }
    }

    return {
      status: false,
      checkType: 'checkExists',
      reason: {
        message: check.exists
          ? `Path should exist but doesn't: ${accessResult.error}`
          : 'Path should not exist but does',
        path,
      },
    }
  }

  /**
   * Checks if an array contains (or doesn't contain) a specific element.
   *
   * @param data - The data object
   * @param path - Path to the array
   * @param check - The array element check specification
   * @returns FilterCheckResult
   */
  private checkArrayElement(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    path: (string | number)[],
    check: CheckArrayElement
  ): FilterCheckResult {
    const accessResult = getValueFromPath(data, path)

    if (!accessResult.found) {
      return {
        status: false,
        checkType: 'checkArrayElement',
        reason: {
          message: accessResult.error || 'Path not found',
          path,
        },
      }
    }

    const array = accessResult.value

    if (!Array.isArray(array)) {
      return {
        status: false,
        checkType: 'checkArrayElement',
        reason: {
          message: 'Value is not an array',
          path,
          actualType: typeof array,
        },
      }
    }

    // Check if item exists in array
    const found = array.some(elem => this.deepEqual(elem, check.item))

    if (check.itemExists === found) {
      return {
        status: true,
        checkType: 'checkArrayElement',
      }
    }

    return {
      status: false,
      checkType: 'checkArrayElement',
      reason: {
        message: check.itemExists
          ? "Item should exist in array but doesn't"
          : 'Item should not exist in array but does',
        path,
        item: check.item,
      },
    }
  }

  /**
   * Checks if an array has the expected size.
   *
   * @param data - The data object
   * @param path - Path to the array
   * @param check - The array size check specification
   * @returns FilterCheckResult
   */
  private checkArraySize(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    path: (string | number)[],
    check: CheckArraySize
  ): FilterCheckResult {
    const accessResult = getValueFromPath(data, path)

    if (!accessResult.found) {
      return {
        status: false,
        checkType: 'checkArraySize',
        reason: {
          message: accessResult.error || 'Path not found',
          path,
        },
      }
    }

    const value = accessResult.value

    /*
     * Arrays are counted by length, objects by their number of keys.
     *
     * A protobuf `map` arrives as an object, not as an array. Without this, "exactly one entry"
     * cannot be expressed for a map at all — and that is the one assertion that catches a
     * second entry nobody expected. Primitives stay an error: counting the characters of a
     * string would answer a question nobody asked.
     */
    const istArray = Array.isArray(value)
    const istObjekt = !istArray && typeof value === 'object' && value !== null

    if (!istArray && !istObjekt) {
      return {
        status: false,
        checkType: 'checkArraySize',
        reason: {
          message: 'Value is neither an array nor an object',
          path,
          actualType: typeof value,
        },
      }
    }

    const actualSize = istArray
      ? (value as unknown[]).length
      : Object.keys(value as Record<string, unknown>).length
    const begriff = istArray ? 'Array length' : 'Entry count'
    const expectedSize = check.size

    let passes = false
    let message = ''

    switch (check.type) {
      case 'equal':
        passes = actualSize === expectedSize
        message = `${begriff} should be ${expectedSize} but is ${actualSize}`
        break
      case 'lessThan':
        passes = actualSize < expectedSize
        message = `${begriff} should be less than ${expectedSize} but is ${actualSize}`
        break
      case 'greaterThan':
        passes = actualSize > expectedSize
        message = `${begriff} should be greater than ${expectedSize} but is ${actualSize}`
        break
    }

    if (passes) {
      return {
        status: true,
        checkType: 'checkArraySize',
      }
    }

    return {
      status: false,
      checkType: 'checkArraySize',
      reason: {
        message,
        path,
        expected: expectedSize,
        actual: actualSize,
      },
    }
  }

  /**
   * Checks if a timestamp is within the expected time range.
   *
   * @param data - The data object
   * @param path - Path to the timestamp
   * @param check - The time range check specification
   * @returns FilterCheckResult
   */
  private checkTimeRange(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    path: (string | number)[],
    check: CheckTimeRange
  ): FilterCheckResult {
    const accessResult = getValueFromPath(data, path)

    if (!accessResult.found) {
      return {
        status: false,
        checkType: 'checkTimeRange',
        reason: {
          message: accessResult.error || 'Path not found',
          path,
        },
      }
    }

    const value = accessResult.value

    // Handle numeric timestamps (milliseconds or seconds)
    if (typeof value === 'number') {
      const min = parseInt(check.min)
      const max = parseInt(check.max)

      if (isNaN(min) || isNaN(max)) {
        return {
          status: false,
          checkType: 'checkTimeRange',
          reason: {
            message: 'Min or max is not a valid number',
            min: check.min,
            max: check.max,
          },
        }
      }

      if (value >= min && value <= max) {
        return {
          status: true,
          checkType: 'checkTimeRange',
        }
      }

      return {
        status: false,
        checkType: 'checkTimeRange',
        reason: {
          message: `Timestamp ${value} is outside range [${min}, ${max}]`,
          path,
          actual: value,
          min,
          max,
        },
      }
    }

    // Handle ISO timestamps
    if (typeof value === 'string') {
      const timestamp = DateTime.fromISO(value)
      const minTime = DateTime.fromISO(check.min)
      const maxTime = DateTime.fromISO(check.max)

      if (!timestamp.isValid) {
        return {
          status: false,
          checkType: 'checkTimeRange',
          reason: {
            message: `Invalid timestamp: ${value}`,
            path,
          },
        }
      }

      if (!minTime.isValid || !maxTime.isValid) {
        return {
          status: false,
          checkType: 'checkTimeRange',
          reason: {
            message: 'Invalid min or max time',
            min: check.min,
            max: check.max,
          },
        }
      }

      if (timestamp >= minTime && timestamp <= maxTime) {
        return {
          status: true,
          checkType: 'checkTimeRange',
        }
      }

      return {
        status: false,
        checkType: 'checkTimeRange',
        reason: {
          message: `Timestamp ${value} is outside range [${check.min}, ${check.max}]`,
          path,
          actual: value,
          min: check.min,
          max: check.max,
        },
      }
    }

    return {
      status: false,
      checkType: 'checkTimeRange',
      reason: {
        message: `Timestamp must be a string or number, got ${typeof value}`,
        path,
      },
    }
  }

  /**
   * Checks if a numeric value is within the expected range.
   *
   * @param data - The data object
   * @param path - Path to the numeric value
   * @param check - The numeric range check specification
   * @returns FilterCheckResult
   */
  private checkNumericRange(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    path: (string | number)[],
    check: CheckNumericRange
  ): FilterCheckResult {
    const accessResult = getValueFromPath(data, path)

    if (!accessResult.found) {
      return {
        status: false,
        checkType: 'checkNumericRange',
        reason: {
          message: accessResult.error || 'Path not found',
          path,
        },
      }
    }

    const value = accessResult.value

    if (typeof value !== 'number') {
      return {
        status: false,
        checkType: 'checkNumericRange',
        reason: {
          message: `Value must be a number, got ${typeof value}`,
          path,
          actual: value,
        },
      }
    }

    if (value >= check.min && value <= check.max) {
      return {
        status: true,
        checkType: 'checkNumericRange',
      }
    }

    return {
      status: false,
      checkType: 'checkNumericRange',
      reason: {
        message: `Value ${value} is outside range [${check.min}, ${check.max}]`,
        path,
        actual: value,
        min: check.min,
        max: check.max,
      },
    }
  }

  /**
   * Checks if a value is one of a set of allowed values.
   *
   * @param data - The data object
   * @param path - Path to the value
   * @param check - The oneOf check specification
   * @returns FilterCheckResult
   */
  private checkOneOf(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    path: (string | number)[],
    check: CheckOneOf
  ): FilterCheckResult {
    const accessResult = getValueFromPath(data, path)

    if (!accessResult.found) {
      return {
        status: false,
        checkType: 'checkOneOf',
        reason: {
          message: accessResult.error || 'Path not found',
          path,
        },
      }
    }

    const actual = accessResult.value
    const found = check.oneOf.some(allowed => this.deepEqual(actual, allowed))

    if (found) {
      return {
        status: true,
        checkType: 'checkOneOf',
      }
    }

    return {
      status: false,
      checkType: 'checkOneOf',
      reason: {
        message: `Value not in allowed set`,
        path,
        actual,
        allowedValues: check.oneOf,
      },
    }
  }

  /**
   * Deep equality comparison.
   * Compares two values recursively for equality.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deepEqual(a: any, b: any): boolean {
    // Same reference
    if (a === b) return true

    // Null checks
    if (a === null || b === null) return a === b
    if (a === undefined || b === undefined) return a === b

    // Type check
    if (typeof a !== typeof b) return false

    // Dates
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime()
    }

    // Arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((val, idx) => this.deepEqual(val, b[idx]))
    }

    // Objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)

      if (keysA.length !== keysB.length) return false

      return keysA.every(key => this.deepEqual(a[key], b[key]))
    }

    // Primitives
    return a === b
  }
}
