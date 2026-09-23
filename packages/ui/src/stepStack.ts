/**
 * The steps on a native stack after the flow moves to `key`, oldest first.
 *
 * Apart from the component so the rules can be held as data: a move back pops down to the step it
 * returns to, and one back to a step that was never pushed replaces the top -- a flow can return
 * somewhere it did not come from. A key appears once, since it names one screen, so a move forward
 * to a step already below lifts it rather than stacking a second copy.
 */
export function nextStack(
  stack: readonly string[],
  key: string,
  direction: 'forward' | 'back',
): string[] {
  const at = stack.lastIndexOf(key)
  if (direction === 'back') return at >= 0 ? stack.slice(0, at + 1) : [...stack.slice(0, -1), key]
  return [...stack.filter((held) => held !== key), key]
}
