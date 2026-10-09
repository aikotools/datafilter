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
 * The path segment that matches any key of an object or any index of an array.
 */
export const PATH_WILDCARD = '*'

/**
 * Expands a path containing {@link PATH_WILDCARD} into every concrete path that exists
 * in the given object.
 *
 * A wildcard stands for one segment and matches **all** keys of an object or **all**
 * indices of an array at that position. Nested wildcards are allowed; the result is the
 * cross product of the branches that actually exist.
 *
 * Paths that do not exist are left out, so the result contains resolvable paths only. A
 * path without a wildcard is returned as is when it exists, and as an empty list when it
 * does not — the caller can therefore treat "no concrete path" the same for both cases.
 *
 * @param object - The object to walk
 * @param path - Path that may contain wildcards
 * @returns Every concrete path that exists, in document order
 *
 * @example
 * ```typescript
 * const obj = { messages: { '3': { code: 'A' }, '7': { code: 'B' } } };
 * expandWildcardPaths(obj, ['messages', '*', 'code']);
 * // [['messages', '3', 'code'], ['messages', '7', 'code']]
 * ```
 */
export function expandWildcardPaths(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  object: any,
  path: PathElement[]
): PathElement[][] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let offen: Array<{ current: any; prefix: PathElement[] }> = [{ current: object, prefix: [] }]

  for (let i = 0; i < path.length; i++) {
    const segment = path[i]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next: Array<{ current: any; prefix: PathElement[] }> = []

    for (const { current, prefix } of offen) {
      if (current === null || current === undefined || typeof current !== 'object') {
        continue
      }

      if (segment === PATH_WILDCARD) {
        if (Array.isArray(current)) {
          current.forEach((value, index) => {
            next.push({ current: value, prefix: [...prefix, index] })
          })
        } else {
          for (const key of Object.keys(current)) {
            next.push({ current: current[key], prefix: [...prefix, key] })
          }
        }
        continue
      }

      if (Array.isArray(current)) {
        const index = typeof segment === 'number' ? segment : parseInt(String(segment), 10)
        if (!isNaN(index) && index >= 0 && index < current.length) {
          next.push({ current: current[index], prefix: [...prefix, index] })
        }
        continue
      }

      const key = String(segment)
      if (key in current) {
        next.push({ current: current[key], prefix: [...prefix, key] })
      }
    }

    offen = next
    if (offen.length === 0) {
      return []
    }
  }

  return offen.map(entry => entry.prefix)
}

/**
 * Whether a path contains at least one wildcard segment.
 *
 * @param path - The path to inspect
 * @returns true when the path has to be expanded before it can be resolved
 */
export function hasWildcard(path: PathElement[]): boolean {
  return path.some(segment => segment === PATH_WILDCARD)
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
