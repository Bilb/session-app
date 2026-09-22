import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ModalStackHost } from '@session/ui'

/**
 * The modal stack, with its chrome named.
 *
 * Here rather than at each app's root so the two apps do not each pick their own words for the
 * same two controls -- and because choosing a catalogue string is a screen's business, not an
 * app's. The apps decide *where* it is mounted; this decides what it says.
 */
export function ModalHost() {
  return (
    <ModalStackHost
      closeLabel={tr('close')}
      backLabel={tr('back')}
      testID={ELEMENT.settings.modal}
      closeTestID={ELEMENT.settings.modalClose}
      backTestID={ELEMENT.settings.modalBack}
    />
  )
}
