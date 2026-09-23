import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ModalStackRoot } from '@session/ui'
import type { ReactNode } from 'react'

/**
 * The app with the modal stack over it, and the stack's chrome named.
 *
 * Here rather than at each app's root so the two apps do not each pick their own words for the
 * same two controls -- and because choosing a catalogue string is a screen's business, not an
 * app's. The apps decide *where* it is mounted; this decides what it says.
 *
 * Around the app rather than beside it, because a phone presents its settings natively over the
 * app's own screen. See `ModalStackRoot`.
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
