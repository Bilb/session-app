import { ModalStackHost } from './ModalStackHost'
import type { ModalStackRootProps } from './ModalStackRoot.types'

export type { ModalStackRootProps }

/**
 * The app with whatever `ModalStackProvider` holds drawn over it. See `ModalStackRoot.native.tsx`
 * for why phones differ.
 */
export function ModalStackRoot({ children, ...host }: ModalStackRootProps) {
  return (
    <>
      {children}
      <ModalStackHost {...host} />
    </>
  )
}
