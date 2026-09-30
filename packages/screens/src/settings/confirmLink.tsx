import { openExternalUrl, requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, ScrollView, textHeight, type Modals } from '@session/ui'

import { LocalizedText } from '../LocalizedText'

/**
 * In lines, so the last visible one is never cut in half. The URL scrolls rather than truncates:
 * a deceptive address hides what it is at its end.
 */
const MAX_LINES = 5
const MAX_URL_HEIGHT = textHeight('body', MAX_LINES)

/**
 * Asks before handing an address to the browser. Every external link must go through this.
 * Presented over whatever is open, so the caller holds no dialog state.
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
          {/* The catalogue string includes the URL, bold and on its own lines. */}
          <LocalizedText text={tr('urlOpenDescription', { url })} size="$body" textAlign="center" />
        </ScrollView>
      ),
      footer: () => (
        <>
          <Button
            // Ghost, not simple: the clients highlight the whole cell when held.
            variant="ghost"
            fill
            // The actions share edges across the dialog, so a rounded highlight would leave gaps.
            borderRadius="$none"
            // Leaving is the irreversible half.
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
