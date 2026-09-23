import { ModalStackHost } from './ModalStackHost'
import type { ModalStackRootProps } from './ModalStackRoot.types'

export type { ModalStackRootProps }

/**
 * The app with whatever `ModalStackProvider` is holding drawn over it.
 *
 * On the web the modals are drawn beside the app, in a window-filling layer of their own. The
 * native half presents a phone's settings the platform's way instead; see it for why.
 */
export function ModalStackRoot({ children, ...host }: ModalStackRootProps) {
  return (
    <>
      {children}
      <ModalStackHost {...host} />
    </>
  )
}
