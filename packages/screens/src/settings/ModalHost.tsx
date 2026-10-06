import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ModalStackRoot } from '@session/ui'
import type { ReactNode } from 'react'

/**
 * The app with the modal stack over it, its chrome labelled here so both apps use the same strings.
 * Wraps the app because a phone presents the stack natively over it; see `ModalStackRoot`.
 */
export function ModalHost({ children }: { children: ReactNode }) {
  return (
    <ModalStackRoot
      closeLabel={tr('close')}
      backLabel={tr('back')}
      testID={ELEMENT.settings.modal}
      closeTestID={ELEMENT.settings.modalClose}
      backTestID={ELEMENT.settings.modalBack}
    >
      {children}
    </ModalStackRoot>
  )
}
