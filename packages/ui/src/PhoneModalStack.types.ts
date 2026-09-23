import type { ReactNode } from 'react'

/** One screen of the modal, as the phone's stack draws it. */
interface PhoneModalScreen {
  key: string
  title: string
  render: () => ReactNode
  footer?: (() => ReactNode) | undefined
}

export interface PhoneModalStackProps {
  /** Oldest first: the first is the modal's own screen, the rest were pushed onto it. */
  screens: readonly PhoneModalScreen[]
  /** Names the close control on the first screen. */
  closeLabel: string
  /** Closes the modal from its first screen, or undefined where it cannot be left that way. */
  onClose?: (() => void) | undefined
  /** The platform took screens off -- a back swipe, the back button -- and the stack must follow. */
  onPop: (count: number) => void
  closeTestID?: string | undefined
}
