import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, buttonHeight, Icon, ROW_TOUCH_TARGET, Text, XStack } from '@session/ui'

import type { AttachmentSet } from './attachmentSet'
import { sharedCaption } from './attachmentSetCaption'
import type { AttachmentView } from './attachmentView'
import { formatBytes } from './formatBytes'
import { PENDING_COPY } from './pendingCopy'

const ACTION_SIZE = 'sm'

/**
 * The verb's height, the tallest thing on the line, and fixed.
 *
 * A number rather than letting the text set it: the whole point is that the height does not
 * change between states, and a line of copy that wraps in one locale would change it.
 */
const FOOTER_HEIGHT = buttonHeight(ACTION_SIZE)

/**
 * The row's own box, taller than the line on touch: a slop never reaches past its parent, so the
 * toggle's target is only as tall as the row that holds it. The overhang comes back as margin, so
 * the line still takes 30 and nothing below moves.
 */
const ROW_HEIGHT = Math.max(FOOTER_HEIGHT, ROW_TOUCH_TARGET)
const ROW_OVERHANG = (ROW_HEIGHT - FOOTER_HEIGHT) / 2

/** The verb takes the row's full height on touch, like the toggle beside it. */
const ACTION_SLOP = ROW_OVERHANG

/**
 * The other shape, as the one button offers it: the gallery from the list, and the list back.
 *
 * Only drawn where the set can be a gallery at all, so a list of plain files offers nothing.
 */
const SWITCH_TO = {
  list: {
    view: 'gallery',
    icon: 'layoutGrid',
    label: PENDING_COPY.attachmentViewGallery,
    testID: ELEMENT.conversation.attachmentViewGallery,
  },
  gallery: {
    view: 'list',
    icon: 'list',
    label: PENDING_COPY.attachmentViewList,
    testID: ELEMENT.conversation.attachmentViewList,
  },
} as const

function caption(set: AttachmentSet): string {
  const shared = sharedCaption(set)
  if (shared !== null) return shared
  if (set.state === 'fetching') {
    return `${formatBytes(set.doneBytes)} / ${formatBytes(set.totalBytes)}`
  }
  return set.sizeBytes === undefined ? '' : formatBytes(set.sizeBytes)
}

/**
 * The one thing this state offers, or null where it offers nothing.
 *
 * Null rather than a disabled word, and the height does not move either way. There is no verb
 * while a transfer runs because nothing can stop one yet - the bridge has no cancel - and none on
 * a set of several that has arrived, because exporting them needs a directory to put them in and
 * offering one Export that quietly writes the first is worse than offering none.
 */
function verb(set: AttachmentSet): string | null {
  if (set.state === 'fetching' || set.state === 'unavailable') return null
  if (set.state === 'failed') return tr('retry')
  // TODO: offer Export for a set of several once `FilesPort` can pick a folder to put them in.
  if (set.state === 'ready') return set.count === 1 ? PENDING_COPY.export : null
  return tr('download')
}

/**
 * The one line a message's attachments get, whatever they are doing.
 *
 * **Always drawn, and always the same height.** A footer that appeared when a download finished
 * would change the message's height at the moment somebody is reading it, and in a transcript
 * that moves everything below. Only the words and the verb change between states.
 *
 * Its scope is the message rather than the gallery: the count is every attachment, including the
 * ones behind "+N" that are never drawn.
 */
export function AttachmentFooter({
  set,
  onAction,
  view,
  onView,
}: {
  set: AttachmentSet
  onAction: () => void
  /** The shape being drawn. Absent where the reader has no choice about it. */
  view?: AttachmentView | undefined
  onView?: ((view: AttachmentView) => void) | undefined
}) {
  const action = verb(set)
  return (
    <XStack
      height={ROW_HEIGHT}
      marginVertical={-ROW_OVERHANG}
      alignItems="center"
      gap="$xs"
      // The overhang lies over the album or list above; only the controls in the row take a touch.
      pointerEvents="box-none"
      testID={ELEMENT.conversation.attachmentFooter}
    >
      {view === undefined || onView === undefined ? null : (
        <Button
          variant="tonal"
          size={ACTION_SIZE}
          circular
          icon={<Icon name={SWITCH_TO[view].icon} size="sm" color="$textPrimary" />}
          accessibilityLabel={SWITCH_TO[view].label}
          hitSlop={ACTION_SLOP}
          onPress={() => {
            onView(SWITCH_TO[view].view)
          }}
          testID={SWITCH_TO[view].testID}
        />
      )}
      <Text
        size="$caption"
        color="$textSecondary"
        flex={1}
        numberOfLines={1}
        testID={ELEMENT.conversation.attachmentState}
      >
        {caption(set)}
      </Text>
      {action === null ? null : (
        <Button
          variant="tonal"
          size={ACTION_SIZE}
          hitSlop={ACTION_SLOP}
          destructive={set.state === 'failed'}
          onPress={onAction}
          testID={ELEMENT.conversation.attachmentAction}
        >
          {action}
        </Button>
      )}
    </XStack>
  )
}
