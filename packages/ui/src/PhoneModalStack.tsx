import type { PhoneModalStackProps } from './PhoneModalStack.types'

export type { PhoneModalStackProps } from './PhoneModalStack.types'

/**
 * Whether this platform draws a modal's screens on its own navigation stack. Not on the web: the
 * desktop client's panel keeps its own header and swaps screens inside it. See the native half.
 */
export const HAS_PHONE_MODAL_STACK = false

/** Nothing, on the web. `ModalStackHost` asks `HAS_PHONE_MODAL_STACK` before drawing this. */
export function PhoneModalStack(_props: PhoneModalStackProps) {
  return null
}
