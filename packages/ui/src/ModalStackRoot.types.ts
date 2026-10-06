import type { ReactNode } from 'react'

export interface ModalStackRootProps {
  /** The app, which the modals are presented over. */
  children: ReactNode
  /** Names the close control for a screen reader, since it is drawn as a cross. */
  closeLabel: string
  /** Names the back control, where the modal draws one of its own. */
  backLabel: string
  testID?: string
  closeTestID?: string
  backTestID?: string
}
