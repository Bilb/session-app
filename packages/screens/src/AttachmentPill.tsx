import { formatBytes } from '@session/basic-types'
import { isolate } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Progress, Text, TILE_SCRIM, XStack, YStack } from '@session/ui'

import type { AttachmentSet } from './attachmentSet'
import { sharedCaption } from './attachmentSetCaption'

/** Enough of a bar to read as one, and not so much that the pill stops being a badge. */
const PILL_BAR_WIDTH = 44

function label(set: AttachmentSet): string {
  return sharedCaption(set) ?? isolate(formatBytes(set.doneBytes))
}

/**
 * What the set is doing, in the album's corner.
 *
 * **Never centred on a tile.** A badge on a tile reads as that tile's state, and this one is about
 * the whole message - including the attachments behind "+N" that the gallery is not drawing. The
 * corner is what says it belongs to the album rather than to the picture under it.
 *
 * On a scrim of its own, because it is drawn over somebody's photograph in one theme and over a
 * near-white placeholder in the other, and white on maybe-white is not a design.
 *
 * Nothing here is a control: the footer under the album carries the verb, where there is room for
 * a word. This says only how far along it is.
 */
export function AttachmentPill({ set }: { set: AttachmentSet }) {
  if (set.state === 'ready') return null

  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingHorizontal="$sm"
      paddingVertical="$3xs"
      borderRadius="$full"
      backgroundColor={TILE_SCRIM}
      // Not a control, so a pointer over it is still over the tile beneath.
      pointerEvents="none"
      testID={ELEMENT.conversation.attachmentPill}
    >
      {/* Light in every theme: the scrim under it is a fixed darkening, not a surface. */}
      <Text size="$caption" color="$surfaceInverted">
        {label(set)}
      </Text>
      {set.state !== 'fetching' ? null : (
        <YStack width={PILL_BAR_WIDTH}>
          <Progress
            // Absent rather than zero while the server has not said how big it is: the first
            // report of any transfer is 0 of 0, which means beginning and not empty.
            value={set.totalBytes > 0 ? set.doneBytes / set.totalBytes : undefined}
            color="$primaryColor"
            trackColor="$backgroundTertiary"
            testID={ELEMENT.conversation.attachmentProgress}
          />
        </YStack>
      )}
    </XStack>
  )
}
