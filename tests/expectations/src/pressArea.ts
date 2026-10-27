import type { Expected } from './node'

/**
 * A pressable control, `Button` included: one button, named, a stop wherever it takes a press.
 * Disabled on native it stays an accessibility element, which says it is dimmed.
 */
export function pressArea({
  name,
  disabled = false,
  busy = false,
}: {
  name: string
  disabled?: boolean | undefined
  busy?: boolean | undefined
}): Expected {
  const node = { role: 'button', name, disabled, busy } as const
  return { desktop: { ...node, focusable: !disabled }, native: { ...node, focusable: true } }
}
