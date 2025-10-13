import type { PathElement } from '../core/types'

/**
 * Result of accessing a value from an object
 */
export interface AccessResult {
  /**
   * The value found at the path (undefined if not found)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any

  /**
   * Whether the path was successfully resolved
   */
  found: boolean

  /**
   * Error message if path couldn't be resolved
   */
  error?: string

  /**
   * The portion of the path that was successfully resolved
   */
  validPath: PathElement[]
}

/**
 * Retrieves a value from an object following the specified path.
 * Supports nested objects and arrays.
 *
 * @param object - The object to access
 * @param path - Array of property names and array indices
 * @returns AccessResult containing the value and status
 *
 * @example
 * ```typescript
 * const obj = { data: { stations: [{ name: 'Berlin' }, { name: 'Munich' }] } };
 * const result = getValueFromPath(obj, ['data', 'stations', 1, 'name']);
 * // result.value === 'Munich'
 * // result.found === true
 * ```
 */
export function getValueFromPath(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object: any,
  path: PathElement[]
): AccessResult {
  const validPath: PathElement[] = []

  // Handle empty path
  if (path.length === 0) {
    return {
      value: object,
      found: true,
      validPath: [],
    }
  }

  // Navigate through the path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = object

  for (let i = 0; i < path.length; i++) {
    const segment = path[i]

    // Handle null or undefined
    if (current === null || current === undefined) {
      return {
        value: undefined,
        found: false,
        error: `Cannot read property '${segment}' of ${current}`,
        validPath,
      }
    }

    // Handle array access
    if (Array.isArray(current)) {
      const index = typeof segment === 'number' ? segment : parseInt(String(segment), 10)

      if (isNaN(index)) {
        return {
          value: undefined,
          found: false,
          error: `Array index must be a number, got '${segment}'`,
          validPath,
        }
      }

      if (index < 0 || index >= current.length) {
        return {
          value: undefined,
          found: false,
          error: `Array index ${index} out of bounds (length: ${current.length})`,
          validPath,
        }
      }

      validPath.push(index)
      current = current[index]
      continue
    }

    // Handle object access
    if (typeof current === 'object') {
      const key = String(segment)

      if (!(key in current)) {
        return {
          value: undefined,
          found: false,
          error: `Property '${key}' does not exist`,
          validPath,
        }
      }

      validPath.push(key)
      current = current[key]
      continue
    }

    // Cannot navigate further
    return {
      value: undefined,
      found: false,
      error: `Cannot access property '${segment}' of primitive type ${typeof current}`,
      validPath,
    }
  }

  return {
    value: current,
    found: true,
    validPath,
  }
}

/**
 * Checks if a path exists in an object.
 *
 * @param object - The object to check
 * @param path - Array of property names and array indices
 * @returns true if the path exists and has a defined value
 *
 * @example
 * ```typescript
 * const obj = { data: { value: 42 } };
 * pathExists(obj, ['data', 'value']); // true
 * pathExists(obj, ['data', 'missing']); // false
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pathExists(object: any, path: PathElement[]): boolean {
  const result = getValueFromPath(object, path)
  return result.found && result.value !== undefined
}

/**
 * Gets a value from an object with a default fallback.
 *
 * @param object - The object to access
 * @param path - Array of property names and array indices
 * @param defaultValue - Value to return if path doesn't exist
 * @returns The value at the path, or defaultValue if not found
 *
 * @example
 * ```typescript
 * const obj = { data: { value: 42 } };
 * getValueOr(obj, ['data', 'value'], 0); // 42
 * getValueOr(obj, ['data', 'missing'], 0); // 0
 * ```
 */
export function getValueOr<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object: any,
  path: PathElement[],
  defaultValue: T
): T {
  const result = getValueFromPath(object, path)
  return result.found && result.value !== undefined ? result.value : defaultValue
}
