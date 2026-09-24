import { openExternalUrl, requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, ScrollView, textHeight, type Modals } from '@session/ui'

import { LocalizedText } from '../LocalizedText'

/**
 * How much of the question and the address is shown before it scrolls.
 *
 * **Lines rather than a pixel height**, so the last one is never cut in half -- which reads as a
 * rendering fault rather than as something to scroll.
 *
 * The address is bounded by the view and never truncated: what a long URL loses to an ellipsis is
 * its end, and the end is where a deceptive one hides what it really is.
 */
const MAX_LINES = 5
const MAX_URL_HEIGHT = textHeight('body', MAX_LINES)

/**
 * Asks before handing an address to the browser.
 *
 * **Every external link goes through this**, including the ones in Help: it is a step, not a
 * convenience, and the app never leaves for a URL without it.
 *
 * Presented on top of whatever is open rather than rendered by the screen that wants it, so a
 * settings row four screens deep does not have to hold dialog state of its own.
 */
export function confirmLink(modals: Modals, url: string): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.onboarding.openUrlDialog,
    closeTestID: ELEMENT.onboarding.openUrlCancel,
    initial: {
      title: tr('urlOpen'),
      render: () => (
        <ScrollView maxHeight={MAX_URL_HEIGHT}>
          {/* The catalogue string carries the address in a bold run and two line breaks before
              it, so the question and the URL are one piece of copy rather than two stacked
              elements. */}
          <LocalizedText text={tr('urlOpenDescription', { url })} size="$body" textAlign="center" />
        </ScrollView>
      ),
      footer: () => (
        <>
          <Button
            // Ghost rather than simple: a dialog's action highlights its whole cell when held,
            // the way the clients' do, where `simple` dims the label and leaves the cell alone.
            variant="ghost"
            fill
            // A cell, not a pill: the actions run the full width of the dialog and share an
            // edge, so a rounded highlight would sit inside its cell with a gap all round it.
            borderRadius="$none"
            // Red on the one that leaves, because leaving is the irreversible half -- and this
            // dialog exists at all because the app is about to hand an address to another
            // program.
            destructive
            testID={ELEMENT.onboarding.openUrlConfirm}
            onPress={() => {
              void openExternalUrl(url)
              modals.dismiss(id)
            }}
          >
            {tr('open')}
          </Button>
          <Button
            variant="ghost"
            fill
            borderRadius="$none"
            testID={ELEMENT.onboarding.copyUrl}
            onPress={() => {
              void requirePorts().clipboard.setString(url)
              modals.dismiss(id)
            }}
          >
            {tr('urlCopy')}
          </Button>
        </>
      ),
    },
  })
}
