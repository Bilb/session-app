import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Modal, ScrollView } from '@session/ui'
import { useEffect, useRef } from 'react'

import { LocalizedText } from '../LocalizedText'

/**
 * Five lines of a wrapped URL. Past that it scrolls.
 *
 * The desktop client caps the same container at 150px. The address is always shown in full rather
 * than truncated -- the part a long URL loses to an ellipsis is the end, and the end is where a
 * deceptive one hides what it really is.
 */
const MAX_URL_HEIGHT = 150

interface OpenUrlModalProps {
  /** The address to confirm, or null when the dialog is closed. */
  url: string | null
  onClose: () => void
}

/**
 * Confirming a link before leaving for the browser.
 *
 * Two actions, both text, as the client draws them: **Open** in danger red and **Copy URL** plain.
 * Red on the one that leaves, because leaving is the irreversible half -- and this dialog exists at
 * all because the app is about to hand an address to another program.
 */
export function OpenUrlModal({ url, onClose }: OpenUrlModalProps) {
  /**
   * The last address shown, kept after `url` goes null.
   *
   * The dialog fades out rather than vanishing, and clearing the text at the same moment emptied
   * it mid-animation -- the box collapsed while it was still visible, which reads as a glitch
   * rather than a dismissal. So the body keeps rendering what it was showing until it is gone.
   */
  const shown = useRef<string>('')
  useEffect(() => {
    if (url !== null) shown.current = url
  }, [url])

  return (
    <Modal
      open={url !== null}
      onClose={onClose}
      title={tr('urlOpen')}
      closeLabel={tr('close')}
      testID={ELEMENT.onboarding.openUrlDialog}
      closeTestID={ELEMENT.onboarding.openUrlCancel}
      actions={
        <>
          <Button
            variant="simple"
            destructive
            testID={ELEMENT.onboarding.openUrlConfirm}
            onPress={() => {
              if (url !== null) void requirePorts().linking.openUrl(url)
              onClose()
            }}
          >
            {tr('open')}
          </Button>
          <Button
            variant="simple"
            testID={ELEMENT.onboarding.copyUrl}
            onPress={() => {
              if (url !== null) void requirePorts().clipboard.setString(url)
              onClose()
            }}
          >
            {tr('urlCopy')}
          </Button>
        </>
      }
    >
      <ScrollView maxHeight={MAX_URL_HEIGHT}>
        {/* The catalogue string carries the address in a bold run and two line breaks before it,
            so the question and the URL are one piece of copy rather than two stacked elements. */}
        <LocalizedText
          text={tr('urlOpenDescription', { url: url ?? shown.current })}
          size="$body"
          textAlign="center"
        />
      </ScrollView>
    </Modal>
  )
}
