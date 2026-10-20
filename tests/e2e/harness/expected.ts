import type { Expected } from '@session/expectations'

/**
 * The desktop side of a shared expectation, for `toMatchObject` against `describe()`. Throws where
 * the expectation says the desktop has no such node, which a caller asserts as `null` instead.
 */
export function onDesktop(expected: Expected): Record<string, unknown> {
  if (expected.desktop === null) throw new Error('the desktop has no such node; expect null')
  return { ...expected.desktop }
}
