import type { ReactNode } from 'react'

/**
 * The props both KeyboardAvoiding variants accept.
 *
 * A third file so neither variant can grow a prop the other lacks. See Screen.types.ts, which is
 * the same arrangement for the same reason.
 */
export interface KeyboardAvoidingProps {
  children: ReactNode
}
